import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { enqueueCampaignNotifications, flushQueued, type NotifType } from "@/lib/notifications";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireRole(["admin"]);
    const { id } = await params;
    const { type, onlyUnclaimed, sendImmediately } = await req.json();

    if (!type) return NextResponse.json({ error: "缺少通知类型" }, { status: 400 });

    const result = await enqueueCampaignNotifications(id, type as NotifType, {
      onlyUnclaimed: !!onlyUnclaimed,
    });

    let sendStats = null;
    if (sendImmediately) {
      sendStats = await flushQueued();
    }

    return NextResponse.json({ ok: true, ...result, send: sendStats });
  } catch (e: any) {
    if (e.message === "UNAUTHORIZED") return NextResponse.json({ error: "请先登录" }, { status: 401 });
    if (e.message === "FORBIDDEN") return NextResponse.json({ error: "权限不足" }, { status: 403 });
    console.error(e);
    return NextResponse.json({ error: e.message || "服务器错误" }, { status: 500 });
  }
}
