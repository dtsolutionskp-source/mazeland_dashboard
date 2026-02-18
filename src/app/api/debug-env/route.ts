import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 10; // 10초 타임아웃

function parseDbUrl(url: string | undefined) {
  if (!url) return null;
  try {
    // postgresql://user:pass@host:port/db?params
    const match = url.match(/postgresql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/([^?]+)(\?.*)?/);
    if (match) {
      return {
        user: match[1],
        password: match[2].substring(0, 4) + '****',
        host: match[3],
        port: match[4],
        database: match[5],
        params: match[6] || '',
      };
    }
    return { raw: url.substring(0, 50) + '...' };
  } catch {
    return { error: 'Failed to parse' };
  }
}

export async function GET() {
  const dbUrlParsed = parseDbUrl(process.env.DATABASE_URL);
  const directUrlParsed = parseDbUrl(process.env.DIRECT_URL);
  
  const envInfo = {
    DATABASE_URL: process.env.DATABASE_URL ? "SET" : "NOT SET",
    DATABASE_URL_PARSED: dbUrlParsed,
    DIRECT_URL: process.env.DIRECT_URL ? "SET" : "NOT SET",
    DIRECT_URL_PARSED: directUrlParsed,
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