import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

/**
 * Optional Postgres wiring. The Game Universe hub itself needs NO database —
 * games + discovery are file-based. Importing this module must NEVER throw
 * when DATABASE_URL is missing (otherwise `/api/health` crashes boot).
 */
const databaseUrl = process.env.DATABASE_URL;

const globalForDb = globalThis as typeof globalThis & {
  __arenaNextJsPostgresqlPool?: Pool;
};

function getPool(): Pool | null {
  if (!databaseUrl) return null;
  if (!globalForDb.__arenaNextJsPostgresqlPool) {
    globalForDb.__arenaNextJsPostgresqlPool = new Pool({ connectionString: databaseUrl });
  }
  return globalForDb.__arenaNextJsPostgresqlPool;
}

export const pool: Pool | null = getPool();

/** Null when DATABASE_URL is not configured — callers must handle it. */
export const db = pool ? drizzle(pool) : null;
