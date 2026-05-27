import { NextResponse } from "next/server";
import { runExpire } from "@/lib/expire";

// POST 或 GET 都可调用（方便定时器/手动触发）
export async function POST() {
  try {
    const result = await runExpire();
    return NextResponse.json({ ok: true, ...result });
  } catch (e: any) {
    console.error(e);
    return NextResponse.json({ error: e.message || "服务器错误" }, { status: 500 });
  }
}

export async function GET() {
  return POST();
}
