import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { enqueueEmployeeNotification, flushQueued } from "@/lib/notifications";

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "请先登录" }, { status: 401 });
  if (user.role !== "verifier" && user.role !== "admin") {
    return NextResponse.json({ error: "无核销权限" }, { status: 403 });
  }

  const { claimCode, qrToken } = await req.json();
  if (!claimCode && !qrToken) {
    return NextResponse.json({ error: "请提供核销码或二维码" }, { status: 400 });
  }

  // 找到 claim
  const claim = await prisma.claim.findFirst({
    where: claimCode ? { claimCode } : { qrToken },
    include: {
      employee: true,
      gift: true,
      campaign: true,
      warehouse: { include: { building: true } },
    },
  });
  if (!claim) {
    return NextResponse.json({ error: "核销码无效" }, { status: 404 });
  }
  if (claim.status === "claimed") {
    return NextResponse.json(
      {
        error: `已于 ${claim.claimedAt?.toLocaleString("zh-CN")} 核销过`,
        detail: {
          employeeName: claim.employee.name,
          employeeNo: claim.employee.employeeNo,
          giftName: claim.gift.name,
          giftEmoji: claim.gift.imageUrl || "🎁",
          campaignName: claim.campaign.name,
          warehouseName: claim.warehouse.building.name,
        },
      },
      { status: 400 }
    );
  }
  if (claim.status === "cancelled") {
    return NextResponse.json({ error: "该预约已取消" }, { status: 400 });
  }
  if (claim.status === "expired") {
    return NextResponse.json({ error: "该预约已过期" }, { status: 400 });
  }

  // 校验核销人楼宇匹配
  if (user.role === "verifier" && claim.warehouseId) {
    if (user.buildingId !== claim.warehouse.buildingId) {
      return NextResponse.json(
        {
          error: `请到 ${claim.warehouse.building.name} 核销`,
          detail: {
            employeeName: claim.employee.name,
            employeeNo: claim.employee.employeeNo,
            giftName: claim.gift.name,
            giftEmoji: claim.gift.imageUrl || "🎁",
            campaignName: claim.campaign.name,
            warehouseName: claim.warehouse.building.name,
          },
        },
        { status: 400 }
      );
    }
  }

  // 校验活动状态
  if (claim.campaign.status === "closed") {
    return NextResponse.json({ error: "活动已结束" }, { status: 400 });
  }

  // 执行核销
  await prisma.$transaction([
    prisma.claim.update({
      where: { id: claim.id },
      data: { status: "claimed", claimedAt: new Date(), verifierId: user.id },
    }),
    prisma.inventory.update({
      where: { warehouseId_giftId: { warehouseId: claim.warehouseId, giftId: claim.giftId } },
      data: {
        qtyReserved: { decrement: 1 },
        qtyClaimed: { increment: 1 },
      },
    }),
    prisma.eligibility.update({
      where: { campaignId_employeeId: { campaignId: claim.campaignId, employeeId: claim.employeeId } },
      data: { status: "claimed" },
    }),
  ]);

  // 核销成功 → 推送签收通知
  try {
    await enqueueEmployeeNotification(claim.campaignId, claim.employeeId, "claimed_confirm");
    await flushQueued();
  } catch (e) {
    console.error("通知发送失败:", e);
  }

  return NextResponse.json({
    ok: true,
    detail: {
      employeeName: claim.employee.name,
      employeeNo: claim.employee.employeeNo,
      giftName: claim.gift.name,
      giftEmoji: claim.gift.imageUrl || "🎁",
      campaignName: claim.campaign.name,
      warehouseName: claim.warehouse.building.name,
    },
  });
}
