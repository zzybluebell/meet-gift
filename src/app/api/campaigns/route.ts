import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { evalRule, Rule } from "@/lib/eligibility";
import { enqueueCampaignNotifications, flushQueued } from "@/lib/notifications";

export async function POST(req: Request) {
  try {
    const user = await requireRole(["admin"]);
    const body = await req.json();
    const { name, holidayType, description, startAt, endAt, selectionMode, eligibilityRule, giftIds, status } = body;

    if (!name?.trim() || !Array.isArray(giftIds) || giftIds.length === 0) {
      return NextResponse.json({ error: "缺少必填字段" }, { status: 400 });
    }

    const rule = (eligibilityRule || { type: "ALL" }) as Rule;

    const campaign = await prisma.campaign.create({
      data: {
        name: name.trim(),
        holidayType,
        description: description || null,
        startAt: new Date(startAt),
        endAt: new Date(endAt),
        selectionMode: giftIds.length > 1 ? "choose_one" : "fixed",
        eligibilityRule: JSON.stringify(rule),
        status: status || "draft",
        createdById: user.id,
        campaignGifts: {
          create: giftIds.map((id: string) => ({ giftId: id, qtyPerEmployee: 1 })),
        },
      },
    });

    // 计算资格名单
    const employees = await prisma.employee.findMany({ where: { status: "active" } });
    const eligibles = employees.filter((e) => evalRule(rule, e));
    if (eligibles.length > 0) {
      await prisma.eligibility.createMany({
        data: eligibles.map((e) => ({
          campaignId: campaign.id,
          employeeId: e.id,
          status: "eligible",
        })),
      });
    }

    // 如果是直接发布的活动，自动 enqueue + flush 初次通知
    let notifyStats = null;
    if (status === "active" && eligibles.length > 0) {
      const r = await enqueueCampaignNotifications(campaign.id, "initial");
      const f = await flushQueued();
      notifyStats = { enqueued: r.enqueued, sent: f.sent, failed: f.failed };
    }

    return NextResponse.json({ id: campaign.id, eligibleCount: eligibles.length, notify: notifyStats });
  } catch (e: any) {
    if (e.message === "UNAUTHORIZED") return NextResponse.json({ error: "请先登录" }, { status: 401 });
    if (e.message === "FORBIDDEN") return NextResponse.json({ error: "权限不足" }, { status: 403 });
    console.error(e);
    return NextResponse.json({ error: "服务器错误" }, { status: 500 });
  }
}
