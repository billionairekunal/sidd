// One-time copy of the old local SQLite database (data/erp.sqlite3) into Supabase.
// Usage:  node --env-file=.env.local scripts/sqlite-to-supabase.mjs
// Keeps the original ids so LR numbers, links and history stay intact.
// Refuses to run if Supabase already has LRs (add --force to wipe and re-copy).
import { DatabaseSync } from "node:sqlite";
import { getSql, SCHEMA } from "../src/server/db.js";

const TABLES = ["users", "vehicles", "clients", "lrs", "lr_items", "lr_status_log"]; // parent tables first
const force = process.argv.includes("--force");

const sql = getSql();
const lite = new DatabaseSync("data/erp.sqlite3", { readOnly: true });

try {
  await sql.unsafe(SCHEMA);
  const [{ c: existing }] = await sql`SELECT COUNT(*) AS c FROM lrs`;
  if (existing > 0 && !force) {
    console.error(`Supabase already has ${existing} LRs — not copying. Use --force to replace everything.`);
    process.exit(1);
  }

  await sql.begin(async (tx) => {
    await tx.unsafe(`TRUNCATE ${[...TABLES].reverse().join(", ")} RESTART IDENTITY CASCADE`);
    for (const table of TABLES) {
      const rows = lite.prepare(`SELECT * FROM ${table} ORDER BY id`).all().map((r) => ({ ...r }));
      if (rows.length) {
        const columns = Object.keys(rows[0]);
        await tx`INSERT INTO ${tx(table)} ${tx(rows, columns)}`;
      }
      // Continue numbering after the copied ids.
      await tx.unsafe(
        `SELECT setval(pg_get_serial_sequence('${table}', 'id'), COALESCE(MAX(id), 1), MAX(id) IS NOT NULL) FROM ${table}`
      );
      console.log(`${table}: ${rows.length} rows`);
    }
  });
  console.log("Done — Supabase now has the same data as data/erp.sqlite3.");
} finally {
  await sql.end();
}
