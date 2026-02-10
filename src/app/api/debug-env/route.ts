import { NextResponse } from "next/server";
import { Client } from "pg";

export const runtime = "nodejs";

export async function GET() {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    return NextResponse.json({ ok: false, error: "DATABASE_URL is missing" }, { status: 500 });
  }

  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
  });

  try {
    await client.connect();
    const r = await client.query("select 1 as x");
    await client.end();
    return NextResponse.json({ ok: true, result: r.rows?.[0] ?? null });
  } catch (e: any) {
    try { await client.end(); } catch {}
    return NextResponse.json(
      { ok: false, name: e?.name, message: e?.message, code: e?.code, stack: e?.stack?.slice?.(0, 400) },
      { status: 500 }
    );
  }
}