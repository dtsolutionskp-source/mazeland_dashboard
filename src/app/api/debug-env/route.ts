import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 10; // 10초 타임아웃

export async function GET() {
  const envInfo = {
    DATABASE_URL: process.env.DATABASE_URL ? "SET (hidden)" : "NOT SET",
    DATABASE_URL_LENGTH: process.env.DATABASE_URL?.length ?? 0,
    DATABASE_URL_STARTS_WITH: process.env.DATABASE_URL ? process.env.DATABASE_URL.substring(0, 30) + "..." : "N/A",
    DIRECT_URL: process.env.DIRECT_URL ? "SET (hidden)" : "NOT SET",
    JWT_SECRET: process.env.JWT_SECRET ? "SET" : "NOT SET",
    OPENAI_API_KEY: process.env.OPENAI_API_KEY ? "SET" : "NOT SET",
    NODE_ENV: process.env.NODE_ENV,
    VERCEL: process.env.VERCEL || "NOT SET",
  };

  let dbTest: Record<string, unknown> = { ok: false, error: "Not tested yet" };

  try {
    // 타임아웃이 있는 DB 연결 테스트
    const { prisma } = await import("@/lib/prisma");
    
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('DB connection timeout (5s)')), 5000)
    );
    
    const queryPromise = prisma.$queryRaw`SELECT 1 as test`;
    
    const result = await Promise.race([queryPromise, timeoutPromise]);
    dbTest = { ok: true, result };
  } catch (e: unknown) {
    const err = e as Error & { code?: string };
    dbTest = {
      ok: false,
      error: err?.message ?? "Unknown error",
      name: err?.name,
      code: err?.code,
    };
  }

  return NextResponse.json({
    timestamp: new Date().toISOString(),
    env: envInfo,
    dbTest,
  });
}