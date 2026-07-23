import { and, asc, desc, eq, gte, like, lte, or } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  appSettings,
  emailTemplates,
  executionLogs,
  feedbackRules,
  opportunities,
  scheduleJobs,
  searchProfiles,
  users,
  type InsertUser,
} from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

// ─── Users ────────────────────────────────────────────────────────────────────
export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) return;

  const values: InsertUser = { openId: user.openId };
  const updateSet: Record<string, unknown> = {};

  const textFields = ["name", "email", "loginMethod"] as const;
  for (const field of textFields) {
    const value = user[field];
    if (value === undefined) continue;
    const normalized = value ?? null;
    values[field] = normalized;
    updateSet[field] = normalized;
  }

  if (user.lastSignedIn !== undefined) {
    values.lastSignedIn = user.lastSignedIn;
    updateSet.lastSignedIn = user.lastSignedIn;
  }
  if (user.role !== undefined) {
    values.role = user.role;
    updateSet.role = user.role;
  } else if (user.openId === ENV.ownerOpenId) {
    values.role = "admin";
    updateSet.role = "admin";
  }

  if (!values.lastSignedIn) values.lastSignedIn = new Date();
  if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = new Date();

  await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result[0];
}

// ─── App Settings ─────────────────────────────────────────────────────────────
export async function getAllSettings() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(appSettings);
}

export async function getSettingValue(key: string): Promise<string | null> {
  const db = await getDb();
  if (!db) return null;
  const [row] = await db.select().from(appSettings).where(eq(appSettings.key, key)).limit(1);
  return row?.value ?? null;
}

export async function upsertSetting(key: string, value: string): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db
    .insert(appSettings)
    .values({ key, value })
    .onDuplicateKeyUpdate({ set: { value } });
}

// ─── Search Profiles ──────────────────────────────────────────────────────────
export async function getSearchProfiles(onlyActive = false) {
  const db = await getDb();
  if (!db) return [];
  if (onlyActive) {
    return db.select().from(searchProfiles).where(eq(searchProfiles.isActive, true));
  }
  return db.select().from(searchProfiles).orderBy(desc(searchProfiles.createdAt));
}

export async function getSearchProfileById(id: number) {
  const db = await getDb();
  if (!db) return null;
  const [row] = await db.select().from(searchProfiles).where(eq(searchProfiles.id, id)).limit(1);
  return row ?? null;
}

// ─── Opportunities ────────────────────────────────────────────────────────────
export interface OpportunityFilters {
  dateFrom?: Date;
  dateTo?: Date;
  country?: string;
  city?: string;
  keyword?: string;
  relevanceLabel?: string;
  status?: string;
  userFeedback?: string;
  page?: number;
  pageSize?: number;
  sortBy?: "date" | "relevance" | "region";
  lastExecutionId?: number;
}

export async function getOpportunities(filters: OpportunityFilters = {}) {
  const db = await getDb();
  if (!db) return { items: [], total: 0 };

  const { page = 1, pageSize = 20 } = filters;
  const offset = (page - 1) * pageSize;

  const conditions = [];
  if (filters.dateFrom) conditions.push(gte(opportunities.createdAt, filters.dateFrom));
  if (filters.dateTo) conditions.push(lte(opportunities.createdAt, filters.dateTo));
  if (filters.country) conditions.push(eq(opportunities.country, filters.country));
  if (filters.city) conditions.push(eq(opportunities.city, filters.city));
  if (filters.keyword) conditions.push(like(opportunities.searchKeyword, `%${filters.keyword}%`));
  if (filters.relevanceLabel) conditions.push(eq(opportunities.relevanceLabel, filters.relevanceLabel as "high" | "medium" | "low" | "irrelevant"));
  if (filters.status) conditions.push(eq(opportunities.status, filters.status as "new" | "reviewed" | "contacted" | "discarded"));
  if (filters.userFeedback) conditions.push(eq(opportunities.userFeedback, filters.userFeedback as "relevant" | "irrelevant"));

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const sortBy = filters.sortBy ?? "date";
  const orderClause =
    sortBy === "relevance"
      ? [desc(opportunities.relevanceScore), desc(opportunities.createdAt)]
      : sortBy === "region"
      ? [asc(opportunities.country), asc(opportunities.city), desc(opportunities.createdAt)]
      : [desc(opportunities.createdAt), desc(opportunities.relevanceScore)];

  const items = await db
    .select()
    .from(opportunities)
    .where(where)
    .orderBy(...orderClause)
    .limit(pageSize)
    .offset(offset);

  const countResult = await db
    .select({ count: opportunities.id })
    .from(opportunities)
    .where(where);

  return { items, total: countResult.length };
}

export async function getOpportunityById(id: number) {
  const db = await getDb();
  if (!db) return null;
  const [row] = await db.select().from(opportunities).where(eq(opportunities.id, id)).limit(1);
  return row ?? null;
}

export async function getDashboardStats() {
  const db = await getDb();
  if (!db) return null;

  const allOpps = await db.select().from(opportunities);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const total = allOpps.length;
  const todayCount = allOpps.filter((o) => o.createdAt >= today).length;
  const highCount = allOpps.filter((o) => o.relevanceLabel === "high").length;
  const newCount = allOpps.filter((o) => o.status === "new").length;
  const avgScore =
    total > 0
      ? allOpps.reduce((sum, o) => sum + (o.relevanceScore || 0), 0) / total
      : 0;

  return { total, todayCount, highCount, newCount, avgScore };
}

// ─── Execution Logs ───────────────────────────────────────────────────────────
export async function getExecutionLogs(limit = 20) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(executionLogs)
    .orderBy(desc(executionLogs.startedAt))
    .limit(limit);
}

export async function getExecutionLogById(id: number) {
  const db = await getDb();
  if (!db) return null;
  const [row] = await db.select().from(executionLogs).where(eq(executionLogs.id, id)).limit(1);
  return row ?? null;
}

// ─── Feedback Rules ───────────────────────────────────────────────────────────
export async function getActiveFeedbackRules() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(feedbackRules).where(eq(feedbackRules.isActive, true));
}

// ─── Email Templates ──────────────────────────────────────────────────────────
export async function getEmailTemplates() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(emailTemplates).orderBy(desc(emailTemplates.createdAt));
}

export async function getDefaultEmailTemplate() {
  const db = await getDb();
  if (!db) return null;
  const [row] = await db
    .select()
    .from(emailTemplates)
    .where(eq(emailTemplates.isDefault, true))
    .limit(1);
  return row ?? null;
}

// ─── Schedule Jobs ────────────────────────────────────────────────────────────
export async function getScheduleJobs() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(scheduleJobs).orderBy(scheduleJobs.name);
}
