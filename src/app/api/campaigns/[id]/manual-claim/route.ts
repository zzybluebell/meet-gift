import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { genClaimCode, genQrToken } from "@/lib/utils";

// 行政补录领取：直接生成已核销的 claim
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireRole(["admin"]);
    const { id: campaignId } = await params;
    const { employeeNo, giftId, warehouseId } = await req.json();

    if (!employeeNo?.trim()) {
      return NextResponse.json({ error: "请填写工号" }, { status: 400 });
    }

    const [campaign, employee] = await Promise.all([
      prisma.campaign.findUnique({
        where: { id: campaignId },
        include: { campaignGifts: { include: { gift: true } } },
      }),
      prisma.employee.findUnique({
        where: { employeeNo: employeeNo.trim() },
        include: { building: true },
      }),
    ]);

    if (!campaign) return NextResponse.json({ error: "活动不存在" }, { status: 404 });
    if (!employee) return NextResponse.json({ error: `工号 ${employeeNo} 不存在` }, { status: 404 });

    // 决定 gift：未指定时取活动第一个礼物
    const finalGiftId = giftId || campaign.campaignGifts[0]?.giftId;
    if (!finalGiftId) {
      return NextResponse.json({ error: "活动尚未配置礼物" }, { status: 400 });
    }
    if (!campaign.campaignGifts.some((cg) => cg.giftId === finalGiftId)) {
      return NextResponse.json({ error: "礼物不在本次活动范围" }, { status: 400 });
    }

    // 决定 warehouse：未指定时取员工所在楼宇
    const finalWarehouseId = warehouseId ||
      (employee.buildingId
        ? (await prisma.warehouse.findUnique({ where: { buildingId: employee.buildingId } }))?.id
        : null);
    if (!finalWarehouseId) {
      return NextResponse.json({ error: "请选择领取楼宇" }, { status: 400 });
    }

    // 校验已有 claim
    const existing = await prisma.claim.findUnique({
      where: { campaignId_employeeId: { campaignId, employeeId: employee.id } },
    });
    if (existing && existing.status === "claimed") {
      return NextResponse.json({ error: "该员工已领取，无需补录" }, { status: 400 });
    }

    // 校验/创建资格
    const eligibility = await prisma.eligibility.findUnique({
      where: { campaignId_employeeId: { campaignId, employeeId: employee.id } },
    });

    // 执行：补录 = 直接创建 claim + 标记 claimed + 库存 qtyClaimed++
    // 所有 qtyClaimed++ 都用 conditional UPDATE 校验 qtyTotal >= qtyReserved + qtyClaimed + 1，
    // 杜绝行政手快/脚本批量补录写超库存
    const result = await prisma.$transaction(async (tx) => {
      // 资格：没有就创建
      if (!eligibility) {
        await tx.eligibility.create({
          data: { campaignId, employeeId: employee.id, status: "claimed" },
        });
      } else {
        await tx.eligibility.update({
          where: { campaignId_employeeId: { campaignId, employeeId: employee.id } },
          data: { status: "claimed" },
        });
      }

      // claim：有 reserved 的转 claimed；有 cancelled/expired 的新建；没有的新建
      let claim;
      if (existing && (existing.status === "reserved")) {
        // 转 claimed
        claim = await tx.claim.update({
          where: { id: existing.id },
          data: {
            status: "claimed",
            claimedAt: new Date(),
            verifierId: admin.id,
            giftId: finalGiftId,
            warehouseId: finalWarehouseId,
          },
        });
        if (existing.warehouseId === finalWarehouseId && existing.giftId === finalGiftId) {
          // 同仓同货：reserved 已经预扣过 qtyTotal 的额度，直接 reserved-- claimed++
          await tx.$executeRaw`
            UPDATE Inventory
            SET qtyReserved = qtyReserved - 1, qtyClaimed = qtyClaimed + 1
            WHERE warehouseId = ${finalWarehouseId} AND giftId = ${finalGiftId}
          `;
        } else {
          // 跨仓/跨货：旧 reserved 释放，新仓 claimed++ 需要校验
          await tx.inventory.update({
            where: { warehouseId_giftId: { warehouseId: existing.warehouseId, giftId: existing.giftId } },
            data: { qtyReserved: { decrement: 1 } },
          });
          const upd = await tx.$executeRaw`
            UPDATE Inventory
            SET qtyClaimed = qtyClaimed + 1
            WHERE warehouseId = ${finalWarehouseId}
              AND giftId = ${finalGiftId}
              AND qtyTotal > qtyReserved + qtyClaimed
          `;
          if (upd === 0) throw new Error("目标楼宇礼物已无库存");
        }
      } else if (existing) {
        // cancelled/expired 的，覆盖
        claim = await tx.claim.update({
          where: { id: existing.id },
          data: {
            status: "claimed",
            claimedAt: new Date(),
            verifierId: admin.id,
            giftId: finalGiftId,
            warehouseId: finalWarehouseId,
            claimCode: genClaimCode(),
            qrToken: genQrToken(),
          },
        });
        const upd = await tx.$executeRaw`
          UPDATE Inventory
          SET qtyClaimed = qtyClaimed + 1
          WHERE warehouseId = ${finalWarehouseId}
            AND giftId = ${finalGiftId}
            AND qtyTotal > qtyReserved + qtyClaimed
        `;
        if (upd === 0) throw new Error("该楼宇礼物已无库存");
      } else {
        // 全新
        claim = await tx.claim.create({
          data: {
            campaignId,
            employeeId: employee.id,
            giftId: finalGiftId,
            warehouseId: finalWarehouseId,
            claimCode: genClaimCode(),
            qrToken: genQrToken(),
            status: "claimed",
            claimedAt: new Date(),
            verifierId: admin.id,
          },
        });
        const upd = await tx.$executeRaw`
          UPDATE Inventory
          SET qtyClaimed = qtyClaimed + 1
          WHERE warehouseId = ${finalWarehouseId}
            AND giftId = ${finalGiftId}
            AND qtyTotal > qtyReserved + qtyClaimed
        `;
        if (upd === 0) throw new Error("该楼宇礼物已无库存");
      }
      return claim;
    });

    return NextResponse.json({
      ok: true,
      claimId: result.id,
      employee: { name: employee.name, no: employee.employeeNo },
    });
  } catch (e: any) {
    if (e.message === "UNAUTHORIZED") return NextResponse.json({ error: "请先登录" }, { status: 401 });
    if (e.message === "FORBIDDEN") return NextResponse.json({ error: "权限不足" }, { status: 403 });
    console.error(e);
    return NextResponse.json({ error: e.message || "服务器错误" }, { status: 500 });
  }
}
