/**
 * Scrape Orchestrator — Coordinates the full scraping pipeline:
 * 1. Read active search profiles and settings
 * 2. Execute Apify scraper for each profile
 * 3. Classify results with LLM + feedback rules
 * 4. Persist opportunities to DB
 * 5. Send email alerts for high-relevance results
 * 6. Update execution log
 */

import { createHash } from "node:crypto";
import { eq, or } from "drizzle-orm";
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
import { expandSearchContext } from "./contextExpander";
import type { EmailConfig } from "./emailAlert";
import type { LinkedInPost } from "./apify";

function createDedupeKey(post: LinkedInPost): string {
  const canonical = post.url
    ? post.url.trim().toLowerCase()
    : [post.authorName || "", post.publishedAt || "", post.text || ""]
        .join("|").replace(/\s+/g, " ").trim().toLowerCase();
  return createHash("sha256").update(canonical).digest("hex").slice(0, 64);
}

function toScoreThreshold(rawValue: string | undefined, fallback: number): number {
  const value = Number.parseFloat(rawValue || "");
  if (!Number.isFinite(value)) return fallback;
  return value <= 1 ? Math.round(value * 100) : value;
}

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
  let totalReview = 0;
  let totalDiscarded = 0;
  let totalPending = 0;
  let totalDuplicates = 0;
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
    const alertMinScore = toScoreThreshold(settings["min_commercial_score"] || settings["min_relevance_score"], 75);
    const alertMinConfidence = Math.max(0, Math.min(1, Number.parseFloat(settings["min_classification_confidence"] || "0.85") || 0.85));

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
      const baseKeywords = (profile.keywords as string[]) || [];
      const useExpanded = profile.useExpandedContext !== false;

      // Determine the queries to use: expanded context or base keywords
      let queries: string[] = baseKeywords;
      let expandedContextData = profile.expandedContext as {
        allQueries: string[];
        alternativeRoles: string[];
        searchPhrases: string[];
        industryKeywords: string[];
        expandedAt: string;
      } | null;

      if (useExpanded) {
        if (!expandedContextData) {
          // Auto-expand if no context exists yet
          try {
            expandedContextData = await expandSearchContext(
              profile.name,
              baseKeywords,
              profile.country ?? undefined,
              profile.city ?? undefined
            );
            // Persist the expanded context for future runs
            await db
              .update(searchProfiles)
              .set({ expandedContext: expandedContextData })
              .where(eq(searchProfiles.id, profile.id));
          } catch (expandErr) {
            console.warn("[Orchestrator] Context expansion failed, using base keywords:", expandErr);
          }
        }
        if (expandedContextData?.allQueries?.length) {
          queries = expandedContextData.allQueries;
        }
      }

      logDetails.push({
        profileId: profile.id,
        profileName: profile.name,
        status: "started",
        queriesUsed: queries.length,
        expandedContext: useExpanded,
        timestamp: new Date().toISOString(),
      });

      try {
        // Run Apify scraper with expanded queries
        // Split into batches of 5 queries to avoid Apify limits on free plans
        const BATCH_SIZE = 5;
        const allPosts: Awaited<ReturnType<typeof runLinkedInScraper>> = [];
        const seenUrls = new Set<string>();

        for (let i = 0; i < queries.length; i += BATCH_SIZE) {
          const batch = queries.slice(i, i + BATCH_SIZE);
          try {
            const batchPosts = await runLinkedInScraper(apifyToken, actorId, {
              queries: batch,
              country: profile.country || undefined,
              city: profile.city || undefined,
              maxResults: Math.ceil(100 / Math.ceil(queries.length / BATCH_SIZE)),
            });
            // Deduplicate by URL across batches
            for (const p of batchPosts) {
              if (!p.url || !seenUrls.has(p.url)) {
                if (p.url) seenUrls.add(p.url);
                allPosts.push(p);
              }
            }
          } catch (batchErr) {
            console.warn(`[Orchestrator] Batch ${i}-${i + BATCH_SIZE} failed:`, batchErr);
          }
        }
        const posts = allPosts;

        totalFound += posts.length;

        logDetails.push({
          profileId: profile.id,
          status: "scraped",
          postsFound: posts.length,
          timestamp: new Date().toISOString(),
        });

        // Candidate recovery is broad; only the intent-v2 classifier decides
        // whether a post is a qualified commercial opportunity.
        const qualifiedForAlerts = [];
        const profileCounts = { qualified: 0, review: 0, discarded: 0, pending: 0, duplicates: 0 };

        for (const post of posts) {
          totalClassified++;
          const classification = await classifyPost(post, feedbackRuleList);
          const dedupeKey = createDedupeKey(post);
          const existing = post.url
            ? await db.select({ id: opportunities.id }).from(opportunities).where(or(eq(opportunities.linkedinUrl, post.url), eq(opportunities.dedupeKey, dedupeKey))).limit(1)
            : await db.select({ id: opportunities.id }).from(opportunities).where(eq(opportunities.dedupeKey, dedupeKey)).limit(1);
          if (existing.length > 0) {
            totalDuplicates++;
            profileCounts.duplicates++;
            continue;
          }

          if (classification.classificationDecision === "qualified") { totalOpportunities++; profileCounts.qualified++; }
          else if (classification.classificationDecision === "review") { totalReview++; profileCounts.review++; }
          else if (classification.classificationDecision === "pending") { totalPending++; profileCounts.pending++; }
          else { totalDiscarded++; profileCounts.discarded++; }

          const [oppResult] = await db.insert(opportunities).values({
            executionLogId: logId, searchProfileId: profile.id, linkedinUrl: post.url || null,
            authorName: post.authorName || null, authorTitle: post.authorTitle || null,
            authorCompany: post.authorCompany || null, authorProfileUrl: post.authorProfileUrl || null,
            contentType: post.contentType, rawText: post.text,
            publishedAt: post.publishedAt ? new Date(post.publishedAt) : null,
            relevanceScore: classification.relevanceScore, relevanceLabel: classification.relevanceLabel,
            commercialScore: classification.commercialScore, classificationDecision: classification.classificationDecision,
            classificationConfidence: classification.classificationConfidence, classificationVersion: classification.classificationVersion,
            classificationReason: classification.classificationReason, detectedKeywords: classification.detectedKeywords,
            intentCategory: classification.intentCategory, authorSide: classification.authorSide,
            serviceCategories: classification.serviceCategories, classificationEvidence: classification.evidence,
            exclusionReasons: classification.exclusionReasons, dedupeKey,
            country: profile.country || null, city: profile.city || null, searchKeyword: queries[0] || null,
            status: classification.classificationDecision === "discarded" ? "discarded" : "new",
          });

          if (classification.classificationDecision === "qualified" && classification.commercialScore >= alertMinScore && classification.classificationConfidence >= alertMinConfidence && emailConfig.alertsEnabled) {
            const oppId = (oppResult as { insertId: number }).insertId;
            const [savedOpp] = await db.select().from(opportunities).where(eq(opportunities.id, oppId)).limit(1);
            if (savedOpp) qualifiedForAlerts.push(savedOpp);
          }
        }

        if (qualifiedForAlerts.length > 0) {
          const emailResult = await sendDigestAlert(emailConfig, qualifiedForAlerts);
          totalEmailsSent += emailResult.sent;
          for (const opp of qualifiedForAlerts) {
            await db.update(opportunities).set({ emailSentAt: new Date() }).where(eq(opportunities.id, opp.id));
          }
        }

        logDetails.push({
          profileId: profile.id, status: "completed", candidatesRecovered: posts.length,
          ...profileCounts, alertsEligible: qualifiedForAlerts.length, timestamp: new Date().toISOString(),
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
        totalReview,
        totalDiscarded,
        totalPending,
        totalDuplicates,
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
        totalReview,
        totalDiscarded,
        totalPending,
        totalDuplicates,
        logDetails,
        durationMs: Date.now() - startTime,
        finishedAt: new Date(),
      })
      .where(eq(executionLogs.id, logId));

    throw err;
  }
}
