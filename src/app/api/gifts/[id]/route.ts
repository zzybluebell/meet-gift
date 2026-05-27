import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";

// PATCH /api/gifts/[id] — 只改商品定义字段，不动 Inventory
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireRole(["admin"]);
    const { id } = await params;
    const body = await req.json();

    const target = await prisma.gift.findUnique({ where: { id } });
    if (!target) return NextResponse.json({ error: "礼物不存在" }, { status: 404 });

    const updates: any = {};
    if (body.name !== undefined) {
      if (!body.name?.trim()) return NextResponse.json({ error: "礼物名称不能为空" }, { status: 400 });
      updates.name = body.name.trim();
    }
    if (body.description !== undefined) updates.description = body.description?.trim() || null;
    if (body.imageUrl !== undefined) updates.imageUrl = body.imageUrl?.trim() || null;
    if (body.value !== undefined) {
      if (typeof body.value !== "number" || body.value < 0) {
        return NextResponse.json({ error: "估值必须是非负数（分）" }, { status: 400 });
      }
      updates.value = body.value;
    }
    if (body.category !== undefined) {
      if (!["food", "daily", "digital", "other"].includes(body.category)) {
        return NextResponse.json({ error: "品类无效" }, { status: 400 });
      }
      updates.category = body.category;
    }
    if (body.allergenTags !== undefined) {
      const tags = Array.isArray(body.allergenTags)
        ? body.allergenTags.filter((t: any) => typeof t === "string" && t.trim())
        : [];
      updates.allergenTags = JSON.stringify(tags);
    }

    const updated = await prisma.gift.update({ where: { id }, data: updates });
    return NextResponse.json({ ok: true, gift: updated });
  } catch (e: any) {
    if (e.message === "UNAUTHORIZED") return NextResponse.json({ error: "请先登录" }, { status: 401 });
    if (e.message === "FORBIDDEN") return NextResponse.json({ error: "权限不足" }, { status: 403 });
    console.error(e);
    return NextResponse.json({ error: e.message || "服务器错误" }, { status: 500 });
  }
}

// DELETE /api/gifts/[id] — 带保护：挂活动 / 有库存 / 有领取记录 任一存在则拒绝
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireRole(["admin"]);
    const { id } = await params;
    const target = await prisma.gift.findUnique({
      where: { id },
      include: {
        _count: { select: { campaignGifts: true, claims: true } },
        inventories: true,
      },
    });
    if (!target) return NextResponse.json({ error: "礼物不存在" }, { status: 404 });

    const reasons: string[] = [];
    if (target._count.campaignGifts > 0) {
      reasons.push(`已挂在 ${target._count.campaignGifts} 个活动里`);
    }
    if (target._count.claims > 0) {
      reasons.push(`已有 ${target._count.claims} 条领取记录`);
    }
    const usedInv = target.inventories.filter(
      (inv) => inv.qtyTotal > 0 || inv.qtyReserved > 0 || inv.qtyClaimed > 0
    );
    if (usedInv.length > 0) {
      reasons.push(`${usedInv.length} 个分仓还有库存（先把总量清零）`);
    }

    if (reasons.length > 0) {
      return NextResponse.json(
        {
          error: "不能删除：" + reasons.join("；"),
          reasons,
          hint: "可以编辑商品信息暂时停用；要删需要先解除所有依赖",
        },
        { status: 409 }
      );
    }

    // 没依赖：清掉 0 库存的 Inventory 行 + 删 Gift
    await prisma.$transaction([
      prisma.inventory.deleteMany({ where: { giftId: id } }),
      prisma.gift.delete({ where: { id } }),
    ]);
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    if (e.message === "UNAUTHORIZED") return NextResponse.json({ error: "请先登录" }, { status: 401 });
    if (e.message === "FORBIDDEN") return NextResponse.json({ error: "权限不足" }, { status: 403 });
    console.error(e);
    return NextResponse.json({ error: e.message || "服务器错误" }, { status: 500 });
  }
}
