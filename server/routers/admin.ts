import { desc, eq } from "drizzle-orm";
import { parse as parseCookie } from "cookie";
import { z } from "zod/v4";
import {
  appSettings,
  emailTemplates,
  executionLogs,
  feedbackRules,
  scheduleJobs,
  searchProfiles,
} from "../../drizzle/schema";
import {
  getAllSettings,
  getDb,
  getEmailTemplates,
  getExecutionLogs,
  getExecutionLogById,
  getScheduleJobs,
  getSearchProfiles,
  upsertSetting,
} from "../db";
import { runScrapeJob } from "../services/scrapeOrchestrator";
import { validateApifyToken } from "../services/apify";
import { testEmailConnection } from "../services/emailAlert";
import { createHeartbeatJob, deleteHeartbeatJob, updateHeartbeatJob } from "../_core/heartbeat";
import { protectedProcedure, router } from "../_core/trpc";
import { COOKIE_NAME } from "../../shared/const";

// Colombia is UTC-5; convert HH:MM Colombia to UTC cron
function colombiaHourToUtcCron(hourColombia: string): string {
  const [h, m] = hourColombia.split(":").map(Number);
  const utcHour = (h + 5) % 24; // UTC-5 → add 5 to get UTC
  return `0 ${m ?? 0} ${utcHour} * * *`;
}

export const adminRouter = router({
  // ── Settings ────────────────────────────────────────────────────────────────
  getSettings: protectedProcedure.query(async () => {
    return getAllSettings();
  }),

  updateSettings: protectedProcedure
    .input(z.object({ settings: z.array(z.object({ key: z.string(), value: z.string() })) }))
    .mutation(async ({ input }) => {
      for (const { key, value } of input.settings) {
        await upsertSetting(key, value);
      }
      return { success: true };
    }),

  validateApifyToken: protectedProcedure
    .input(z.object({ token: z.string() }))
    .mutation(async ({ input }) => {
      const valid = await validateApifyToken(input.token);
      return { valid };
    }),

  testEmailConnection: protectedProcedure
    .input(
      z.object({
        host: z.string(),
        port: z.number(),
        user: z.string(),
        password: z.string(),
      })
    )
    .mutation(async ({ input }) => {
      return testEmailConnection({
        host: input.host,
        port: input.port,
        user: input.user,
        password: input.password,
        from: input.user,
        recipient: "",
        subject: "",
        alertsEnabled: false,
      });
    }),

  // ── Search Profiles ─────────────────────────────────────────────────────────
  getSearchProfiles: protectedProcedure.query(async () => {
    return getSearchProfiles();
  }),

  createSearchProfile: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1),
        country: z.string().optional(),
        city: z.string().optional(),
        keywords: z.array(z.string()),
        isActive: z.boolean().default(true),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB not available");
      const [result] = await db.insert(searchProfiles).values({
        name: input.name,
        country: input.country ?? null,
        city: input.city ?? null,
        keywords: input.keywords,
        isActive: input.isActive,
      });
      return { id: (result as { insertId: number }).insertId };
    }),

  updateSearchProfile: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        name: z.string().min(1).optional(),
        country: z.string().optional(),
        city: z.string().optional(),
        keywords: z.array(z.string()).optional(),
        isActive: z.boolean().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB not available");
      const { id, ...data } = input;
      await db.update(searchProfiles).set(data).where(eq(searchProfiles.id, id));
      return { success: true };
    }),

  deleteSearchProfile: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB not available");
      await db.delete(searchProfiles).where(eq(searchProfiles.id, input.id));
      return { success: true };
    }),

  // ── Execution ────────────────────────────────────────────────────────────────
  runManualScrape: protectedProcedure.mutation(async () => {
    const logId = await runScrapeJob("manual");
    return { logId };
  }),

  getExecutionLogs: protectedProcedure
    .input(z.object({ limit: z.number().default(20) }))
    .query(async ({ input }) => {
      return getExecutionLogs(input.limit);
    }),

  getExecutionLogById: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      return getExecutionLogById(input.id);
    }),

  // ── Scheduler ────────────────────────────────────────────────────────────────
  getScheduleJobs: protectedProcedure.query(async () => {
    return getScheduleJobs();
  }),

  upsertScheduleJob: protectedProcedure
    .input(
      z.object({
        id: z.number().optional(),
        name: z.string(),
        description: z.string().optional(),
        hourColombia: z.string(), // "HH:MM" in Colombia time
        isEnabled: z.boolean().default(true),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("DB not available");

      const cronExpression = colombiaHourToUtcCron(input.hourColombia);
      const sessionToken = parseCookie(ctx.req.headers.cookie ?? "")[COOKIE_NAME] ?? "";

      if (input.id) {
        // Update existing
        const [existing] = await db
          .select()
          .from(scheduleJobs)
          .where(eq(scheduleJobs.id, input.id))
          .limit(1);

        if (existing?.scheduleCronTaskUid) {
          await updateHeartbeatJob(
            existing.scheduleCronTaskUid,
            { cron: cronExpression, enable: input.isEnabled },
            sessionToken
          );
        }

        await db
          .update(scheduleJobs)
          .set({
            cronExpression,
            hourColombia: input.hourColombia,
            isEnabled: input.isEnabled,
            description: input.description ?? null,
          })
          .where(eq(scheduleJobs.id, input.id));

        return { success: true };
      } else {
        // Create new heartbeat job
        const jobName = `linkedin-scrape-${input.name.toLowerCase().replace(/\s+/g, "-")}`;

        let taskUid: string | undefined;
        try {
          const job = await createHeartbeatJob(
            {
              name: jobName,
              cron: cronExpression,
              path: "/api/scheduled/scrape",
              payload: {},
              description: input.description || `Scraping LinkedIn — ${input.hourColombia} hora Colombia`,
            },
            sessionToken
          );
          taskUid = job.taskUid;
        } catch {
          // If heartbeat creation fails (e.g. not deployed), still save the config
          taskUid = undefined;
        }

        const [result] = await db.insert(scheduleJobs).values({
          name: jobName,
          description: input.description ?? null,
          cronExpression,
          hourColombia: input.hourColombia,
          isEnabled: input.isEnabled,
          scheduleCronTaskUid: taskUid ?? null,
        });

        return { id: (result as { insertId: number }).insertId, taskUid };
      }
    }),

  deleteScheduleJob: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("DB not available");

      const [existing] = await db
        .select()
        .from(scheduleJobs)
        .where(eq(scheduleJobs.id, input.id))
        .limit(1);

      if (existing?.scheduleCronTaskUid) {
        const sessionToken = parseCookie(ctx.req.headers.cookie ?? "")[COOKIE_NAME] ?? "";
        try {
          await deleteHeartbeatJob(existing.scheduleCronTaskUid, sessionToken);
        } catch {
          // Ignore if already deleted on platform
        }
      }

      await db.delete(scheduleJobs).where(eq(scheduleJobs.id, input.id));
      return { success: true };
    }),

  // ── Email Templates ──────────────────────────────────────────────────────────
  getEmailTemplates: protectedProcedure.query(async () => {
    return getEmailTemplates();
  }),

  createEmailTemplate: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1),
        subject: z.string().min(1),
        bodyHtml: z.string().min(1),
        bodyText: z.string().optional(),
        supportImageUrl: z.string().optional(),
        isDefault: z.boolean().default(false),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB not available");

      if (input.isDefault) {
        await db.update(emailTemplates).set({ isDefault: false });
      }

      const [result] = await db.insert(emailTemplates).values({
        name: input.name,
        subject: input.subject,
        bodyHtml: input.bodyHtml,
        bodyText: input.bodyText ?? null,
        supportImageUrl: input.supportImageUrl ?? null,
        isDefault: input.isDefault,
      });
      return { id: (result as { insertId: number }).insertId };
    }),

  updateEmailTemplate: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        name: z.string().optional(),
        subject: z.string().optional(),
        bodyHtml: z.string().optional(),
        bodyText: z.string().optional(),
        supportImageUrl: z.string().optional(),
        isDefault: z.boolean().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB not available");

      if (input.isDefault) {
        await db.update(emailTemplates).set({ isDefault: false });
      }

      const { id, ...data } = input;
      await db.update(emailTemplates).set(data).where(eq(emailTemplates.id, id));
      return { success: true };
    }),

  deleteEmailTemplate: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB not available");
      await db.delete(emailTemplates).where(eq(emailTemplates.id, input.id));
      return { success: true };
    }),

  // ── Feedback Rules ───────────────────────────────────────────────────────────
  getFeedbackRules: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];
    return db.select().from(feedbackRules).orderBy(desc(feedbackRules.weight));
  }),

  deleteFeedbackRule: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB not available");
      await db.delete(feedbackRules).where(eq(feedbackRules.id, input.id));
      return { success: true };
    }),
});
