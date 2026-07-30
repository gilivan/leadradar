import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { registerStorageProxy } from "./storageProxy";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { sdk } from "./sdk";
import { runScrapeJob } from "../services/scrapeOrchestrator";
import { getDb } from "../db";
import { eq } from "drizzle-orm";
import { scheduleJobs } from "../../drizzle/schema";
import { isLocalAuthEnabled, localLogin } from "./localAuth";
import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import { getSessionCookieOptions } from "./cookies";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

/** Start local cron scheduler using node-cron (used when LOCAL_AUTH=true) */
async function startLocalCron() {
  try {
    const cron = await import("node-cron");
    const db = await getDb();
    if (!db) return;

    // Read schedule from DB every minute and fire if needed
    // We use a simple approach: check app_settings for cron expressions
    const { getSettingValue } = await import("../db");

    // Schedule a check every minute
    cron.schedule("* * * * *", async () => {
      try {
        const cronExpr1 = await getSettingValue("schedule_cron_1");
        const cronExpr2 = await getSettingValue("schedule_cron_2");
        const now = new Date();
        const minute = now.getUTCMinutes();
        const hour = now.getUTCHours();

        for (const expr of [cronExpr1, cronExpr2]) {
          if (!expr) continue;
          // Simple check: parse "minute hour * * *" format
          const parts = expr.trim().split(/\s+/);
          if (parts.length >= 2) {
            const cronMinute = parseInt(parts[0]);
            const cronHour = parseInt(parts[1]);
            if (!isNaN(cronMinute) && !isNaN(cronHour) &&
                minute === cronMinute && hour === cronHour) {
              console.log(`[LocalCron] Firing scheduled scrape at ${now.toISOString()}`);
              runScrapeJob("scheduled").catch(err =>
                console.error("[LocalCron] Scrape error:", err)
              );
            }
          }
        }
      } catch (err) {
        console.error("[LocalCron] Error checking schedule:", err);
      }
    });

    console.log("[LocalCron] Local cron scheduler started");
  } catch (err) {
    console.warn("[LocalCron] node-cron not available, scheduled jobs disabled:", err);
  }
}

async function startServer() {
  const app = express();
  const server = createServer(app);
  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  registerStorageProxy(app);

  if (isLocalAuthEnabled()) {
    // ── Local Auth Routes ────────────────────────────────────────────────────
    console.log("[Auth] Running in LOCAL AUTH mode (no Manus OAuth)");

    // Login endpoint
    app.post("/api/auth/login", async (req, res) => {
      const { username, password } = req.body ?? {};
      if (!username || !password) {
        return res.status(400).json({ error: "username and password required" });
      }
      const token = await localLogin(username, password);
      if (!token) {
        return res.status(401).json({ error: "Invalid credentials" });
      }
      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, token, { ...cookieOptions, maxAge: ONE_YEAR_MS });
      return res.json({ success: true });
    });

    // Logout endpoint
    app.post("/api/auth/logout", (req, res) => {
      const cookieOptions = getSessionCookieOptions(req);
      res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return res.json({ success: true });
    });

    // Start local cron scheduler
    await startLocalCron();
  } else {
    // ── Manus OAuth Routes ───────────────────────────────────────────────────
    registerOAuthRoutes(app);

    // ── Heartbeat handler for scheduled LinkedIn scraping ──────────────────
    app.post("/api/scheduled/scrape", async (req, res) => {
      try {
        const user = await sdk.authenticateRequest(req);
        if (!user.isCron || !user.taskUid) {
          return res.status(403).json({ error: "cron-only" });
        }

        // Update lastRunAt on the matching schedule job
        try {
          const db = await getDb();
          if (db) {
            await db
              .update(scheduleJobs)
              .set({ lastRunAt: new Date() })
              .where(eq(scheduleJobs.scheduleCronTaskUid, user.taskUid));
          }
        } catch { /* non-critical */ }

        const logId = await runScrapeJob("scheduled");
        return res.json({ ok: true, logId });
      } catch (err) {
        const error = (err as Error).message;
        console.error("[Scheduled Scrape] Error:", error);
        return res.status(500).json({
          error,
          context: { url: req.url, taskUid: (err as Record<string, unknown>).taskUid },
          timestamp: new Date().toISOString(),
        });
      }
    });
  }

  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );

  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
    if (isLocalAuthEnabled()) {
      console.log(`[Auth] Login at http://localhost:${port}/login`);
    }
  });
}

startServer().catch(console.error);
