import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { genClaimCode, genQrToken } from "@/lib/utils";
import { enqueueEmployeeNotification, flushQueued } from "@/lib/notifications";

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "请先登录" }, { status: 401 });

  const { campaignId, giftId, warehouseId } = await req.json();
  if (!campaignId || !giftId || !warehouseId) {
    return NextResponse.json({ error: "参数错误" }, { status: 400 });
  }

  // 校验资格
  const eligibility = await prisma.eligibility.findUnique({
    where: { campaignId_employeeId: { campaignId, employeeId: user.id } },
  });
  if (!eligibility) {
    return NextResponse.json({ error: "你不在本次活动的资格名单中" }, { status: 403 });
  }

  // 校验活动状态
  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
    include: { campaignGifts: true },
  });
  if (!campaign) return NextResponse.json({ error: "活动不存在" }, { status: 404 });
  if (campaign.status !== "active") return NextResponse.json({ error: "活动未进行中" }, { status: 400 });
  if (new Date() > campaign.endAt) return NextResponse.json({ error: "活动已截止" }, { status: 400 });

  // 校验 gift 是否属于该 campaign
  if (!campaign.campaignGifts.some((cg) => cg.giftId === giftId)) {
    return NextResponse.json({ error: "礼物不在本次活动范围" }, { status: 400 });
  }

  // 校验是否已有未取消的 claim（幂等）
  const existing = await prisma.claim.findUnique({
    where: { campaignId_employeeId: { campaignId, employeeId: user.id } },
  });
  if (existing && existing.status !== "cancelled") {
    return NextResponse.json({ error: "你已预约过本次福利", id: existing.id }, { status: 409 });
  }

  // 校验并锁定库存（事务）
  try {
    const claim = await prisma.$transaction(async (tx) => {
      const inv = await tx.inventory.findUnique({
        where: { warehouseId_giftId: { warehouseId, giftId } },
      });
      const available = (inv?.qtyTotal ?? 0) - (inv?.qtyReserved ?? 0) - (inv?.qtyClaimed ?? 0);
      if (!inv || available <= 0) {
        throw new Error("该楼宇已缺货，请选其他楼宇");
      }
      await tx.inventory.update({
        where: { warehouseId_giftId: { warehouseId, giftId } },
        data: { qtyReserved: { increment: 1 } },
      });

      // 如果之前有 cancelled 的，更新它；否则创建
      if (existing) {
        return tx.claim.update({
          where: { id: existing.id },
          data: {
            giftId,
            warehouseId,
            claimCode: genClaimCode(),
            qrToken: genQrToken(),
            status: "reserved",
            reservedAt: new Date(),
            claimedAt: null,
            verifierId: null,
          },
        });
      }
      return tx.claim.create({
        data: {
          campaignId,
          employeeId: user.id,
          giftId,
          warehouseId,
          claimCode: genClaimCode(),
          qrToken: genQrToken(),
          status: "reserved",
        },
      });
    });

    // 预约成功 → 推送确认通知
    try {
      await enqueueEmployeeNotification(campaignId, user.id, "reserved_confirm");
      await flushQueued();
    } catch (e) {
      console.error("通知发送失败:", e);
    }

    return NextResponse.json({ ok: true, id: claim.id, claimCode: claim.claimCode });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "预约失败" }, { status: 400 });
  }
}
