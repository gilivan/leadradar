import { and, desc, eq, gte, like, lte } from "drizzle-orm";
import { z } from "zod/v4";
import { opportunities } from "../../drizzle/schema";
import {
  getDb,
  getDashboardStats,
  getOpportunities,
  getOpportunityById,
} from "../db";
import { protectedProcedure, router } from "../_core/trpc";

export const opportunitiesRouter = router({
  list: protectedProcedure
    .input(
      z.object({
        page: z.number().min(1).default(1),
        pageSize: z.number().min(1).max(100).default(20),
        dateFrom: z.string().optional(),
        dateTo: z.string().optional(),
        country: z.string().optional(),
        city: z.string().optional(),
        keyword: z.string().optional(),
        relevanceLabel: z.string().optional(),
        classificationDecision: z.enum(["qualified", "review", "discarded", "pending"]).optional(),
        status: z.string().optional(),
        userFeedback: z.string().optional(),
        sortBy: z.enum(["date", "relevance", "region"]).optional(),
      })
    )
    .query(async ({ input }) => {
      return getOpportunities({
        ...input,
        dateFrom: input.dateFrom ? new Date(input.dateFrom) : undefined,
        dateTo: input.dateTo ? new Date(input.dateTo) : undefined,
      });
    }),

  getById: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      return getOpportunityById(input.id);
    }),

  dashboardStats: protectedProcedure.query(async () => {
    return getDashboardStats();
  }),

  getLastExecutionId: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) return null;
    // Use the MAX executionLogId present in opportunities so that even runs
    // that ended in error (e.g. SMTP failure) but did save results are included.
    const { max } = await import("drizzle-orm");
    const [row] = await db
      .select({ maxId: max(opportunities.executionLogId) })
      .from(opportunities);
    return row?.maxId ?? null;
  }),

  updateStatus: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        status: z.enum(["new", "reviewed", "contacted", "discarded"]),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB not available");
      await db
        .update(opportunities)
        .set({ status: input.status })
        .where(eq(opportunities.id, input.id));
      return { success: true };
    }),

  submitFeedback: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        feedback: z.enum(["relevant", "irrelevant"]),
        note: z.string().optional(),
        reason: z.enum(["vacante", "autopromocion", "opinion", "repost", "fuera_de_objetivo", "sin_intencion", "duplicado", "otro"]).optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB not available");

      const [opp] = await db
        .select()
        .from(opportunities)
        .where(eq(opportunities.id, input.id))
        .limit(1);
      if (!opp) throw new Error("Oportunidad no encontrada");

      const isRelevant = input.feedback === "relevant";
      await db
        .update(opportunities)
        .set({
          userFeedback: input.feedback,
          feedbackNote: input.note ?? null,
          feedbackReason: input.reason ?? null,
          feedbackAt: new Date(),
          classificationDecision: isRelevant ? "qualified" : "discarded",
          status: isRelevant ? "reviewed" : "discarded",
          commercialScore: isRelevant ? Math.max(opp.commercialScore || 0, 75) : 0,
          relevanceScore: isRelevant ? Math.max(opp.relevanceScore || 0, 0.75) : 0,
          relevanceLabel: isRelevant ? "high" : "irrelevant",
          classificationReason: isRelevant
            ? "Calificada mediante validación humana."
            : `Descartada mediante validación humana${input.reason ? `: ${input.reason.replace(/_/g, " ")}` : ""}.`,
        })
        .where(eq(opportunities.id, input.id));

      return { success: true };
    }),

  exportData: protectedProcedure
    .input(
      z.object({
        dateFrom: z.string().optional(),
        dateTo: z.string().optional(),
        country: z.string().optional(),
        relevanceLabel: z.string().optional(),
        classificationDecision: z.enum(["qualified", "review", "discarded", "pending"]).optional(),
        status: z.string().optional(),
      })
    )
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];

      const conditions = [];
      if (input.dateFrom) conditions.push(gte(opportunities.createdAt, new Date(input.dateFrom)));
      if (input.dateTo) conditions.push(lte(opportunities.createdAt, new Date(input.dateTo)));
      if (input.country) conditions.push(eq(opportunities.country, input.country));
      if (input.relevanceLabel) conditions.push(eq(opportunities.relevanceLabel, input.relevanceLabel as "high" | "medium" | "low" | "irrelevant"));
      if (input.classificationDecision) {
        conditions.push(eq(opportunities.classificationDecision, input.classificationDecision));
      }
      if (input.status) conditions.push(eq(opportunities.status, input.status as "new" | "reviewed" | "contacted" | "discarded"));

      const where = conditions.length > 0 ? and(...conditions) : undefined;

      return db
        .select()
        .from(opportunities)
        .where(where)
        .orderBy(desc(opportunities.commercialScore), desc(opportunities.classificationConfidence), desc(opportunities.createdAt))
        .limit(1000);
    }),
});
