import { NextResponse, after } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { genClaimCode, genQrToken } from "@/lib/utils";
import { enqueueEmployeeNotification, flushQueued } from "@/lib/notifications";
import { claimLimiter, rateLimitResponse } from "@/lib/rate-limit";

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "请先登录" }, { status: 401 });

  // 限流：单用户 10s 5 次（防双击 + 防脚本）
  const rl = await claimLimiter.check(user.id);
  const limited = rateLimitResponse(rl);
  if (limited) return limited;

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
      // 原子库存扣减：在 SQL 层用 conditional UPDATE 一次完成"校验 + 写入"，
      // 避免 read-then-write 在并发下的潜在 race。即使 SQLite 写串行化已经能防超卖，
      // 这种写法在未来迁 Postgres 时同样安全，且语义更清晰。
      const updatedCount = await tx.$executeRaw`
        UPDATE Inventory
        SET qtyReserved = qtyReserved + 1
        WHERE warehouseId = ${warehouseId}
          AND giftId = ${giftId}
          AND qtyTotal > qtyReserved + qtyClaimed
      `;
      if (updatedCount === 0) {
        throw new Error("该楼宇已缺货，请选其他楼宇");
      }

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

    // 通知异步化：用 Next.js 15 的 after() 在 response 返回后执行，
    // 避免飞书/邮件 RPC 拖慢用户感知 RT
    after(async () => {
      try {
        await enqueueEmployeeNotification(campaignId, user.id, "reserved_confirm");
        await flushQueued();
      } catch (e) {
        console.error("通知发送失败:", e);
      }
    });

    return NextResponse.json({ ok: true, id: claim.id, claimCode: claim.claimCode });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "预约失败" }, { status: 400 });
  }
}
