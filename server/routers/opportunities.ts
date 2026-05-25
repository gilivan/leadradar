import { and, desc, eq, gte, like, lte } from "drizzle-orm";
import { z } from "zod/v4";
import {
  feedbackRules,
  opportunities,
} from "../../drizzle/schema";
import {
  getDb,
  getDashboardStats,
  getOpportunities,
  getOpportunityById,
} from "../db";
import { extractFeedbackSignals } from "../services/classifier";
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
        status: z.string().optional(),
        userFeedback: z.string().optional(),
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
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB not available");

      // Update opportunity feedback
      await db
        .update(opportunities)
        .set({
          userFeedback: input.feedback,
          feedbackNote: input.note ?? null,
          feedbackAt: new Date(),
        })
        .where(eq(opportunities.id, input.id));

      // Extract learning signals from the opportunity text
      const [opp] = await db
        .select()
        .from(opportunities)
        .where(eq(opportunities.id, input.id))
        .limit(1);

      if (opp?.rawText) {
        const signals = extractFeedbackSignals(opp.rawText, input.feedback);

        for (const signal of signals) {
          // Upsert feedback rule (increment weight if exists)
          const existing = await db
            .select()
            .from(feedbackRules)
            .where(eq(feedbackRules.pattern, signal.pattern))
            .limit(1);

          if (existing.length > 0) {
            const rule = existing[0];
            const newWeight = Math.min(3.0, (rule.weight || 1) + 0.2);
            const newOccurrences = (rule.occurrences || 1) + 1;
            await db
              .update(feedbackRules)
              .set({ weight: newWeight, occurrences: newOccurrences })
              .where(eq(feedbackRules.id, rule.id));
          } else {
            await db.insert(feedbackRules).values({
              pattern: signal.pattern,
              patternType: "phrase",
              signal: signal.signal,
              weight: 1.0,
              occurrences: 1,
              isActive: true,
            });
          }
        }
      }

      return { success: true };
    }),

  exportData: protectedProcedure
    .input(
      z.object({
        dateFrom: z.string().optional(),
        dateTo: z.string().optional(),
        country: z.string().optional(),
        relevanceLabel: z.string().optional(),
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
      if (input.status) conditions.push(eq(opportunities.status, input.status as "new" | "reviewed" | "contacted" | "discarded"));

      const where = conditions.length > 0 ? and(...conditions) : undefined;

      return db
        .select()
        .from(opportunities)
        .where(where)
        .orderBy(desc(opportunities.relevanceScore), desc(opportunities.createdAt))
        .limit(1000);
    }),
});
