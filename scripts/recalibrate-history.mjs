import "dotenv/config";
import { eq, or, sql } from "drizzle-orm";
import { opportunities } from "../drizzle/schema.ts";
import { getDb } from "../server/db.ts";
import { reclassifyHistoricalOpportunities } from "../server/services/historicalReclassification.ts";

const batchSize = Math.max(1, Math.min(100, Number(process.env.BATCH_SIZE ?? 100)));
const batches = Math.max(1, Number(process.env.BATCHES ?? 1));

function wait(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function countCandidates(db) {
  const [result] = await db
    .select({ count: sql`COUNT(*)` })
    .from(opportunities)
    .where(
      or(
        eq(opportunities.classificationVersion, "legacy"),
        eq(opportunities.classificationDecision, "pending")
      )
    );
  return Number(result?.count ?? 0);
}

async function main() {
  const db = await getDb();
  if (!db) throw new Error("Base de datos no disponible");

  const initialCandidates = await countCandidates(db);
  console.log(JSON.stringify({ event: "start", initialCandidates, batchSize, batches }));

  const totals = { processed: 0, qualified: 0, review: 0, discarded: 0, pending: 0 };
  for (let batch = 1; batch <= batches; batch += 1) {
    const before = await countCandidates(db);
    if (before === 0) break;

    // This service only updates classification fields. It does not call emailAlert.
    const result = await reclassifyHistoricalOpportunities(batchSize);
    for (const key of Object.keys(totals)) totals[key] += result[key];

    const after = await countCandidates(db);
    console.log(JSON.stringify({ event: "batch_complete", batch, before, after, result }));

    // Stop rather than repeatedly consuming the same pending records after an LLM outage.
    if (result.processed === 0 || (after >= before && result.pending > 0)) {
      console.warn(JSON.stringify({ event: "halted", reason: "sin_progreso", batch }));
      break;
    }
    if (batch < batches) await wait(750);
  }

  const remainingCandidates = await countCandidates(db);
  console.log(JSON.stringify({ event: "complete", initialCandidates, remainingCandidates, totals }));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
