import { NextResponse } from "next/server";
import { autoEnqueueReminders, flushQueued } from "@/lib/notifications";

// 模拟 cron：跑一轮 = 自动催领 + 全部 flush
export async function POST() {
  try {
    const reminders = await autoEnqueueReminders();
    const flush = await flushQueued();
    return NextResponse.json({ ok: true, reminders, flush });
  } catch (e: any) {
    console.error(e);
    return NextResponse.json({ error: e.message || "服务器错误" }, { status: 500 });
  }
}

export async function GET() {
  return POST();
}
