/**
 * Scrape Orchestrator — Coordinates the full scraping pipeline:
 * 1. Read active search profiles and settings
 * 2. Execute Apify scraper for each profile
 * 3. Classify results with LLM + feedback rules
 * 4. Persist opportunities to DB
 * 5. Send email alerts for high-relevance results
 * 6. Update execution log
 */

import { and, desc, eq, gte } from "drizzle-orm";
import {
  appSettings,
  executionLogs,
  feedbackRules,
  opportunities,
  searchProfiles,
} from "../../drizzle/schema";
import { getDb } from "../db";
import { runLinkedInScraper } from "./apify";
import { classifyPost } from "./classifier";
import { sendDigestAlert } from "./emailAlert";
import type { EmailConfig } from "./emailAlert";

export type TriggerType = "manual" | "scheduled";

export async function runScrapeJob(triggeredBy: TriggerType = "manual"): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Base de datos no disponible");

  // Create execution log
  const [logResult] = await db.insert(executionLogs).values({
    triggeredBy,
    status: "running",
    startedAt: new Date(),
  });
  const logId = (logResult as { insertId: number }).insertId;

  const startTime = Date.now();
  let totalFound = 0;
  let totalClassified = 0;
  let totalOpportunities = 0;
  let totalEmailsSent = 0;
  const logDetails: Record<string, unknown>[] = [];
  const profilesRun: number[] = [];

  try {
    // Load settings
    const settingsRows = await db.select().from(appSettings);
    const settings: Record<string, string> = {};
    for (const row of settingsRows) {
      settings[row.key] = row.value || "";
    }

    const apifyToken = settings["apify_token"] || "";
    const actorId = settings["apify_actor_id"] || "harvestapi/linkedin-post-search";
    const minScore = parseFloat(settings["min_relevance_score"] || "0.3");

    if (!apifyToken) {
      throw new Error("API token de Apify no configurado. Ve a Configuración > Apify para agregarlo.");
    }

    // Load active search profiles
    const profiles = await db
      .select()
      .from(searchProfiles)
      .where(eq(searchProfiles.isActive, true));

    if (profiles.length === 0) {
      throw new Error("No hay perfiles de búsqueda activos. Crea al menos uno en Configuración > Perfiles.");
    }

    // Load feedback rules for improved classification
    const rules = await db
      .select()
      .from(feedbackRules)
      .where(eq(feedbackRules.isActive, true));

    const feedbackRuleList = rules.map((r) => ({
      pattern: r.pattern,
      signal: r.signal as "positive" | "negative",
      weight: r.weight || 1,
    }));

    // Load email config
    const emailConfig: EmailConfig = {
      host: settings["smtp_host"] || "",
      port: parseInt(settings["smtp_port"] || "587"),
      user: settings["smtp_user"] || "",
      password: settings["smtp_password"] || "",
      from: settings["smtp_from"] || "",
      recipient: settings["email_recipient"] || "",
      subject: settings["email_subject"] || "Nueva oportunidad comercial",
      alertsEnabled: settings["email_alerts_enabled"] === "true",
    };

    // Process each profile
    for (const profile of profiles) {
      profilesRun.push(profile.id);
      const keywords = (profile.keywords as string[]) || [];

      logDetails.push({
        profileId: profile.id,
        profileName: profile.name,
        status: "started",
        timestamp: new Date().toISOString(),
      });

      try {
        // Run Apify scraper
        const posts = await runLinkedInScraper(apifyToken, actorId, {
          queries: keywords,
          country: profile.country || undefined,
          city: profile.city || undefined,
          maxResults: 50,
        });

        totalFound += posts.length;

        logDetails.push({
          profileId: profile.id,
          status: "scraped",
          postsFound: posts.length,
          timestamp: new Date().toISOString(),
        });

        // Classify each post
        const highRelevanceOpps = [];

        for (const post of posts) {
          totalClassified++;
          const classification = await classifyPost(post, feedbackRuleList, minScore);

          if (classification.relevanceScore < minScore) continue;

          // Check for duplicate (same URL)
          if (post.url) {
            const existing = await db
              .select({ id: opportunities.id })
              .from(opportunities)
              .where(eq(opportunities.linkedinUrl, post.url))
              .limit(1);
            if (existing.length > 0) continue;
          }

          const [oppResult] = await db.insert(opportunities).values({
            executionLogId: logId,
            searchProfileId: profile.id,
            linkedinUrl: post.url || null,
            authorName: post.authorName || null,
            authorTitle: post.authorTitle || null,
            authorCompany: post.authorCompany || null,
            authorProfileUrl: post.authorProfileUrl || null,
            contentType: post.contentType,
            rawText: post.text,
            publishedAt: post.publishedAt ? new Date(post.publishedAt) : null,
            relevanceScore: classification.relevanceScore,
            relevanceLabel: classification.relevanceLabel,
            classificationReason: classification.classificationReason,
            detectedKeywords: classification.detectedKeywords,
            intentCategory: classification.intentCategory,
            country: profile.country || null,
            city: profile.city || null,
            searchKeyword: keywords[0] || null,
            status: "new",
          });

          totalOpportunities++;

          if (classification.relevanceLabel === "high" && emailConfig.alertsEnabled) {
            const oppId = (oppResult as { insertId: number }).insertId;
            const [savedOpp] = await db
              .select()
              .from(opportunities)
              .where(eq(opportunities.id, oppId))
              .limit(1);
            if (savedOpp) highRelevanceOpps.push(savedOpp);
          }
        }

        // Send consolidated digest email for high-relevance opportunities
        if (highRelevanceOpps.length > 0) {
          const emailResult = await sendDigestAlert(emailConfig, highRelevanceOpps);
          totalEmailsSent += emailResult.sent;

          // Mark as email sent
          for (const opp of highRelevanceOpps) {
            await db
              .update(opportunities)
              .set({ emailSentAt: new Date() })
              .where(eq(opportunities.id, opp.id));
          }
        }

        logDetails.push({
          profileId: profile.id,
          status: "completed",
          opportunitiesFound: totalOpportunities,
          highRelevanceCount: highRelevanceOpps.length,
          timestamp: new Date().toISOString(),
        });
      } catch (profileErr) {
        logDetails.push({
          profileId: profile.id,
          status: "error",
          error: (profileErr as Error).message,
          timestamp: new Date().toISOString(),
        });
      }
    }

    // Update execution log as completed
    await db
      .update(executionLogs)
      .set({
        status: totalOpportunities > 0 ? "completed" : "partial",
        profilesRun,
        totalFound,
        totalClassified,
        totalOpportunities,
        totalEmailsSent,
        logDetails,
        durationMs: Date.now() - startTime,
        finishedAt: new Date(),
      })
      .where(eq(executionLogs.id, logId));

    return logId;
  } catch (err) {
    await db
      .update(executionLogs)
      .set({
        status: "failed",
        errorMessage: (err as Error).message,
        profilesRun,
        totalFound,
        totalClassified,
        totalOpportunities,
        logDetails,
        durationMs: Date.now() - startTime,
        finishedAt: new Date(),
      })
      .where(eq(executionLogs.id, logId));

    throw err;
  }
}
