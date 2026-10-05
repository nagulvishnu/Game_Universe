import { sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET() {
  // Hub is file-based — DB is optional. Report status, never crash boot.
  let db: { execute: (q: ReturnType<typeof sql>) => Promise<unknown> } | undefined;
  try {
    const mod = (await import("@/db")) as { db?: unknown };
    if (mod.db) db = mod.db as NonNullable<typeof db>;
  } catch {
    db = undefined;
  }
  if (!db) {
    return Response.json({ ok: true, db: "unconfigured" });
  }
  try {
    await db.execute(sql`select 1`);
    return Response.json({ ok: true, db: "up" });
  } catch {
    return Response.json({ ok: false, db: "down" }, { status: 500 });
  }
}
