import { asc, eq, or } from "drizzle-orm";
import { opportunities } from "../../drizzle/schema";
import { getDb } from "../db";
import { classifyPost } from "./classifier";

export type ReclassificationSummary = {
  processed: number;
  qualified: number;
  review: number;
  discarded: number;
  pending: number;
};

/**
 * Reprocesses a bounded group of legacy/pending records with intent-v2.
 * It intentionally never sends alerts: historical cleanup is an audit action,
 * not a new lead detection event.
 */
export async function reclassifyHistoricalOpportunities(
  requestedLimit = 100
): Promise<ReclassificationSummary> {
  const db = await getDb();
  if (!db) throw new Error("Base de datos no disponible");

  const limit = Math.max(1, Math.min(100, requestedLimit));
  const candidates = await db
    .select()
    .from(opportunities)
    .where(
      or(
        eq(opportunities.classificationVersion, "legacy"),
        eq(opportunities.classificationDecision, "pending")
      )
    )
    .orderBy(asc(opportunities.createdAt))
    .limit(limit);

  const summary: ReclassificationSummary = {
    processed: 0,
    qualified: 0,
    review: 0,
    discarded: 0,
    pending: 0,
  };

  for (const opportunity of candidates) {
    const classification = await classifyPost({
      id: String(opportunity.id),
      url: opportunity.linkedinUrl || "",
      text: opportunity.rawText,
      authorName: opportunity.authorName || undefined,
      authorTitle: opportunity.authorTitle || undefined,
      authorCompany: opportunity.authorCompany || undefined,
      authorProfileUrl: opportunity.authorProfileUrl || undefined,
      publishedAt: opportunity.publishedAt?.toISOString(),
      contentType: opportunity.contentType || "post",
    });

    await db
      .update(opportunities)
      .set({
        relevanceScore: classification.relevanceScore,
        relevanceLabel: classification.relevanceLabel,
        commercialScore: classification.commercialScore,
        classificationDecision: classification.classificationDecision,
        classificationConfidence: classification.classificationConfidence,
        classificationVersion: classification.classificationVersion,
        classificationReason: classification.classificationReason,
        detectedKeywords: classification.detectedKeywords,
        intentCategory: classification.intentCategory,
        authorSide: classification.authorSide,
        serviceCategories: classification.serviceCategories,
        classificationEvidence: classification.evidence,
        exclusionReasons: classification.exclusionReasons,
        status:
          classification.classificationDecision === "discarded"
            ? "discarded"
            : opportunity.status || "new",
      })
      .where(eq(opportunities.id, opportunity.id));

    summary.processed++;
    summary[classification.classificationDecision]++;
  }

  return summary;
}
