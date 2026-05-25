import {
  boolean,
  float,
  int,
  json,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/mysql-core";

// ─── Users ────────────────────────────────────────────────────────────────────
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// ─── App Settings (key-value store for global config) ─────────────────────────
export const appSettings = mysqlTable("app_settings", {
  id: int("id").autoincrement().primaryKey(),
  key: varchar("key", { length: 128 }).notNull().unique(),
  value: text("value"),
  description: text("description"),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type AppSetting = typeof appSettings.$inferSelect;

// ─── Search Profiles ──────────────────────────────────────────────────────────
export const searchProfiles = mysqlTable("search_profiles", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  country: varchar("country", { length: 100 }),
  city: varchar("city", { length: 100 }),
  keywords: json("keywords").$type<string[]>().notNull(),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type SearchProfile = typeof searchProfiles.$inferSelect;
export type InsertSearchProfile = typeof searchProfiles.$inferInsert;

// ─── Schedule Jobs ────────────────────────────────────────────────────────────
export const scheduleJobs = mysqlTable("schedule_jobs", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 128 }).notNull().unique(),
  description: text("description"),
  cronExpression: varchar("cronExpression", { length: 64 }).notNull(),
  // Hour Colombia (UTC-5) stored as display value, e.g. "08:00"
  hourColombia: varchar("hourColombia", { length: 8 }),
  isEnabled: boolean("isEnabled").default(true).notNull(),
  scheduleCronTaskUid: varchar("scheduleCronTaskUid", { length: 65 }),
  lastRunAt: timestamp("lastRunAt"),
  nextRunAt: timestamp("nextRunAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ScheduleJob = typeof scheduleJobs.$inferSelect;
export type InsertScheduleJob = typeof scheduleJobs.$inferInsert;

// ─── Execution Logs ───────────────────────────────────────────────────────────
export const executionLogs = mysqlTable("execution_logs", {
  id: int("id").autoincrement().primaryKey(),
  triggeredBy: mysqlEnum("triggeredBy", ["manual", "scheduled"]).notNull().default("manual"),
  status: mysqlEnum("status", ["running", "completed", "failed", "partial"]).notNull().default("running"),
  profilesRun: json("profilesRun").$type<number[]>(),
  totalFound: int("totalFound").default(0),
  totalClassified: int("totalClassified").default(0),
  totalOpportunities: int("totalOpportunities").default(0),
  totalEmailsSent: int("totalEmailsSent").default(0),
  errorMessage: text("errorMessage"),
  logDetails: json("logDetails").$type<Record<string, unknown>[]>(),
  durationMs: int("durationMs"),
  startedAt: timestamp("startedAt").defaultNow().notNull(),
  finishedAt: timestamp("finishedAt"),
});

export type ExecutionLog = typeof executionLogs.$inferSelect;
export type InsertExecutionLog = typeof executionLogs.$inferInsert;

// ─── Opportunities ────────────────────────────────────────────────────────────
export const opportunities = mysqlTable("opportunities", {
  id: int("id").autoincrement().primaryKey(),
  executionLogId: int("executionLogId"),
  searchProfileId: int("searchProfileId"),

  // LinkedIn data
  linkedinUrl: varchar("linkedinUrl", { length: 1024 }),
  authorName: varchar("authorName", { length: 255 }),
  authorTitle: varchar("authorTitle", { length: 512 }),
  authorCompany: varchar("authorCompany", { length: 255 }),
  authorProfileUrl: varchar("authorProfileUrl", { length: 1024 }),
  contentType: mysqlEnum("contentType", ["post", "comment", "article", "other"]).default("post"),
  rawText: text("rawText").notNull(),
  publishedAt: timestamp("publishedAt"),

  // Classification
  relevanceScore: float("relevanceScore").default(0), // 0.0 – 1.0
  relevanceLabel: mysqlEnum("relevanceLabel", ["high", "medium", "low", "irrelevant"]).default("medium"),
  classificationReason: text("classificationReason"),
  detectedKeywords: json("detectedKeywords").$type<string[]>(),
  intentCategory: varchar("intentCategory", { length: 128 }), // e.g. "busca agencia", "campaña publicitaria"

  // Status & feedback
  status: mysqlEnum("status", ["new", "reviewed", "contacted", "discarded"]).default("new"),
  userFeedback: mysqlEnum("userFeedback", ["relevant", "irrelevant"]),
  feedbackNote: text("feedbackNote"),
  feedbackAt: timestamp("feedbackAt"),

  // Email alert
  emailSentAt: timestamp("emailSentAt"),

  // Region (from search profile at time of scraping)
  country: varchar("country", { length: 100 }),
  city: varchar("city", { length: 100 }),
  searchKeyword: varchar("searchKeyword", { length: 255 }),

  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Opportunity = typeof opportunities.$inferSelect;
export type InsertOpportunity = typeof opportunities.$inferInsert;

// ─── Feedback Rules (learned patterns) ───────────────────────────────────────
export const feedbackRules = mysqlTable("feedback_rules", {
  id: int("id").autoincrement().primaryKey(),
  pattern: text("pattern").notNull(), // text pattern or keyword
  patternType: mysqlEnum("patternType", ["keyword", "phrase", "regex"]).default("phrase"),
  signal: mysqlEnum("signal", ["positive", "negative"]).notNull(),
  weight: float("weight").default(1.0), // how strongly this rule influences score
  occurrences: int("occurrences").default(1), // how many times this was confirmed
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type FeedbackRule = typeof feedbackRules.$inferSelect;

// ─── Email Templates ──────────────────────────────────────────────────────────
export const emailTemplates = mysqlTable("email_templates", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  subject: varchar("subject", { length: 512 }).notNull(),
  bodyHtml: text("bodyHtml").notNull(),
  bodyText: text("bodyText"),
  supportImageUrl: varchar("supportImageUrl", { length: 1024 }),
  isDefault: boolean("isDefault").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type EmailTemplate = typeof emailTemplates.$inferSelect;
export type InsertEmailTemplate = typeof emailTemplates.$inferInsert;
