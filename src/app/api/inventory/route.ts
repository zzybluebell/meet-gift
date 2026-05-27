import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";

export async function POST(req: Request) {
  try {
    await requireRole(["admin"]);
    const { giftId, warehouseId, qtyTotal } = await req.json();
    if (!giftId || !warehouseId || typeof qtyTotal !== "number") {
      return NextResponse.json({ error: "参数错误" }, { status: 400 });
    }

    const existing = await prisma.inventory.findUnique({
      where: { warehouseId_giftId: { warehouseId, giftId } },
    });
    if (existing && qtyTotal < existing.qtyReserved + existing.qtyClaimed) {
      return NextResponse.json(
        { error: `总量不能小于已锁定+已发放 (${existing.qtyReserved + existing.qtyClaimed})` },
        { status: 400 }
      );
    }

    const inv = await prisma.inventory.upsert({
      where: { warehouseId_giftId: { warehouseId, giftId } },
      update: { qtyTotal },
      create: { warehouseId, giftId, qtyTotal },
    });

    return NextResponse.json({ ok: true, inventory: inv });
  } catch (e: any) {
    if (e.message === "UNAUTHORIZED") return NextResponse.json({ error: "请先登录" }, { status: 401 });
    if (e.message === "FORBIDDEN") return NextResponse.json({ error: "权限不足" }, { status: 403 });
    console.error(e);
    return NextResponse.json({ error: "服务器错误" }, { status: 500 });
  }
}
