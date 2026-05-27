import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { enqueueCampaignNotifications, flushQueued } from "@/lib/notifications";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireRole(["admin"]);
    const { id } = await params;
    const body = await req.json();
    const updates: any = {};
    if (body.status && ["draft", "published", "active", "closed"].includes(body.status)) {
      updates.status = body.status;
    }
    const prev = await prisma.campaign.findUnique({ where: { id }, select: { status: true } });
    const updated = await prisma.campaign.update({ where: { id }, data: updates });

    // 状态从 draft/published 变成 active 时，自动 enqueue 初次通知
    let notifyStats = null;
    if (updates.status === "active" && prev?.status !== "active") {
      const r = await enqueueCampaignNotifications(id, "initial");
      const f = await flushQueued();
      notifyStats = { enqueued: r.enqueued, sent: f.sent, failed: f.failed };
    }
    return NextResponse.json({ ok: true, status: updated.status, notify: notifyStats });
  } catch (e: any) {
    if (e.message === "UNAUTHORIZED") return NextResponse.json({ error: "请先登录" }, { status: 401 });
    if (e.message === "FORBIDDEN") return NextResponse.json({ error: "权限不足" }, { status: 403 });
    console.error(e);
    return NextResponse.json({ error: "服务器错误" }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireRole(["admin"]);
    const { id } = await params;
    const claimedCount = await prisma.claim.count({ where: { campaignId: id, status: "claimed" } });
    if (claimedCount > 0) {
      return NextResponse.json({ error: "已有员工领取，不能删除" }, { status: 400 });
    }
    await prisma.campaign.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    if (e.message === "UNAUTHORIZED") return NextResponse.json({ error: "请先登录" }, { status: 401 });
    if (e.message === "FORBIDDEN") return NextResponse.json({ error: "权限不足" }, { status: 403 });
    console.error(e);
    return NextResponse.json({ error: "服务器错误" }, { status: 500 });
  }
}
