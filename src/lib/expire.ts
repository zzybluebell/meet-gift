// 自动过期核心逻辑（PRD §11）
// 1. endAt 已过的 active 活动 → closed
// 2. status=reserved 但活动已 closed 的 claim → expired + 释放 reserved 库存
// 3. eligibility.status=eligible 但活动已 closed → expired

import { prisma } from "./prisma";

export type ExpireResult = {
  closedCampaigns: number;
  expiredClaims: number;
  releasedInventoryCount: number;
  expiredEligibilities: number;
};

export async function runExpire(): Promise<ExpireResult> {
  const now = new Date();

  // 1. 关闭已过期的 active 活动
  const toClose = await prisma.campaign.findMany({
    where: { status: "active", endAt: { lt: now } },
    select: { id: true },
  });
  if (toClose.length > 0) {
    await prisma.campaign.updateMany({
      where: { id: { in: toClose.map((c) => c.id) } },
      data: { status: "closed" },
    });
  }

  // 2. 过期 reserved 状态的 claim（活动已 closed 或 endAt + 24h 已过）
  const graceUntil = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const toExpire = await prisma.claim.findMany({
    where: {
      status: "reserved",
      OR: [
        { campaign: { status: "closed" } },
        { campaign: { endAt: { lt: graceUntil } } },
      ],
    },
    select: { id: true, giftId: true, warehouseId: true, campaignId: true, employeeId: true },
  });

  if (toExpire.length > 0) {
    await prisma.$transaction(async (tx) => {
      for (const c of toExpire) {
        await tx.claim.update({
          where: { id: c.id },
          data: { status: "expired" },
        });
        await tx.inventory.update({
          where: { warehouseId_giftId: { warehouseId: c.warehouseId, giftId: c.giftId } },
          data: { qtyReserved: { decrement: 1 } },
        });
      }
    });
  }

  // 3. 过期 eligible 状态的 eligibility（活动已 closed）
  const closedIds = await prisma.campaign.findMany({
    where: { status: "closed" },
    select: { id: true },
  });
  const expiredElig = await prisma.eligibility.updateMany({
    where: {
      campaignId: { in: closedIds.map((c) => c.id) },
      status: "eligible",
    },
    data: { status: "expired" },
  });

  return {
    closedCampaigns: toClose.length,
    expiredClaims: toExpire.length,
    releasedInventoryCount: toExpire.length,
    expiredEligibilities: expiredElig.count,
  };
}
