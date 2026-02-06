import { NextResponse } from "next/server"
import { PrismaClient } from "@prisma/client"

export async function GET() {
  try {
    const prisma = new PrismaClient()
    const result = await prisma.$queryRaw`select now() as now`
    await prisma.$disconnect()

    return NextResponse.json({
      ok: true,
      result,
      env: {
        hasDatabaseUrl: !!process.env.DATABASE_URL,
        databaseUrlPrefix: process.env.DATABASE_URL?.slice(0, 40),
      },
    })
  } catch (e: any) {
    return NextResponse.json(
      {
        ok: false,
        error: {
          name: e?.name,
          message: e?.message,
          stack: e?.stack,
        },
        env: {
          hasDatabaseUrl: !!process.env.DATABASE_URL,
          databaseUrlPrefix: process.env.DATABASE_URL?.slice(0, 40),
        },
      },
      { status: 500 }
    )
  }
}