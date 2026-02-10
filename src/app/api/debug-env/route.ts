import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const envInfo = {
    DATABASE_URL: process.env.DATABASE_URL ? "SET (hidden)" : "NOT SET",
    DATABASE_URL_LENGTH: process.env.DATABASE_URL?.length ?? 0,
    DATABASE_URL_STARTS_WITH: process.env.DATABASE_URL ? process.env.DATABASE_URL.substring(0, 30) + "..." : "N/A",
    JWT_SECRET: process.env.JWT_SECRET ? "SET" : "NOT SET",
    OPENAI_API_KEY: process.env.OPENAI_API_KEY ? "SET" : "NOT SET",
    NODE_ENV: process.env.NODE_ENV,
  };

  let dbTest: Record<string, unknown> = { ok: false, error: "Not tested yet" };

  try {
    // Prisma로 DB 연결 테스트
    const result = await prisma.$queryRaw`SELECT 1 as test`;
    dbTest = { ok: true, result };
  } catch (e: unknown) {
    const err = e as Error & { code?: string };
    dbTest = {
      ok: false,
      error: err?.message ?? "Unknown error",
      name: err?.name,
      code: err?.code,
      stack: err?.stack?.slice?.(0, 500),
    };
  }

  return NextResponse.json({
    timestamp: new Date().toISOString(),
    env: envInfo,
    dbTest,
  });
}