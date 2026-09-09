import "dotenv/config";
import nodemailer from "nodemailer";
import { appSettings } from "../drizzle/schema.ts";
import { getDb } from "../server/db.ts";
import { buildEmailConfig } from "../server/services/scrapeOrchestrator.ts";

async function main() {
  const db = await getDb();
  if (!db) throw new Error("Base de datos no disponible");

  const rows = await db.select().from(appSettings);
  const settings = Object.fromEntries(rows.map((row) => [row.key, row.value || ""]));
  const config = buildEmailConfig(settings);
  if (!config.host || !config.user || !config.password || !config.recipient) {
    throw new Error("La configuración SMTP persistida está incompleta");
  }

  const transporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.port === 465,
    auth: { user: config.user, pass: config.password },
    tls: { rejectUnauthorized: false },
  });
  await transporter.verify();
  console.log(JSON.stringify({ smtp: "verified", hostConfigured: Boolean(config.host), senderConfigured: Boolean(config.from) }));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
