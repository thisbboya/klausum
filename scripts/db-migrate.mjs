// Applies pending SQL migrations to the remote Supabase DB.
// Usage: node scripts/db-migrate.mjs <migration-file> [...more]
// Reads SUPABASE_PROJECT_ID / SUPABASE_DB_PASSWORD from .env; tries the
// session pooler across regions (IPv4) since direct db host is IPv6-only.
import { readFileSync } from "node:fs";
import pg from "pg";

const env = Object.fromEntries(
  readFileSync(new URL("../.env", import.meta.url), "utf8")
    .split(/\r?\n/)
    .filter((l) => l.includes("="))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).replace(/^"|"$/g, "")]),
);

const REGIONS = [
  "us-east-1", "eu-central-1", "eu-west-1", "eu-west-2", "eu-west-3",
  "us-west-1", "us-east-2", "ap-southeast-1", "ap-south-1", "sa-east-1", "af-south-1",
];

async function connect() {
  for (const prefix of ["aws-1", "aws-0"]) {
  for (const region of REGIONS) {
    for (const port of [6543, 5432]) {
      const client = new pg.Client({
        host: `${prefix}-${region}.pooler.supabase.com`,
        port,
        user: `postgres.${env.SUPABASE_PROJECT_ID}`,
        password: env.SUPABASE_DB_PASSWORD,
        database: "postgres",
        ssl: { rejectUnauthorized: false },
        connectionTimeoutMillis: 8000,
      });
      try {
        await client.connect();
        console.log(`connected via ${region}:${port}`);
        return client;
      } catch (e) {
        await client.end().catch(() => {});
        if (!/tenant|not found|timeout|ENOTFOUND|ECONNREFUSED/i.test(e.message)) throw e;
      }
    }
  }
  }
  throw new Error("No pooler region accepted this project id");
}

const files = process.argv.slice(2);
if (files.length === 0) {
  console.error("usage: node scripts/db-migrate.mjs <file.sql> [...]");
  process.exit(1);
}
const client = await connect();
for (const f of files) {
  const sql = readFileSync(f, "utf8");
  await client.query(sql);
  console.log(`applied ${f}`);
}
await client.end();
