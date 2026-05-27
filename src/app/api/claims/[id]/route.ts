import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "请先登录" }, { status: 401 });
  const { id } = await params;

  const claim = await prisma.claim.findUnique({ where: { id } });
  if (!claim) return NextResponse.json({ error: "记录不存在" }, { status: 404 });
  if (claim.employeeId !== user.id && user.role !== "admin") {
    return NextResponse.json({ error: "无权操作" }, { status: 403 });
  }
  if (claim.status !== "reserved") {
    return NextResponse.json({ error: "已核销或已取消的记录不能再取消" }, { status: 400 });
  }

  await prisma.$transaction([
    prisma.claim.update({ where: { id }, data: { status: "cancelled" } }),
    prisma.inventory.update({
      where: { warehouseId_giftId: { warehouseId: claim.warehouseId, giftId: claim.giftId } },
      data: { qtyReserved: { decrement: 1 } },
    }),
  ]);

  return NextResponse.json({ ok: true });
}
