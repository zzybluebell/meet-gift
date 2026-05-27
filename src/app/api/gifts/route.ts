import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";

// POST /api/gifts
// body: {
//   name, description?, imageUrl?, value, category, allergenTags?: string[],
//   initialInventory?: { warehouseId: string; qtyTotal: number }[]
// }
export async function POST(req: Request) {
  try {
    await requireRole(["admin"]);
    const body = await req.json();
    const {
      name,
      description,
      imageUrl,
      value,
      category,
      allergenTags,
      initialInventory,
    } = body;

    if (!name?.trim()) {
      return NextResponse.json({ error: "礼物名称必填" }, { status: 400 });
    }
    if (typeof value !== "number" || value < 0) {
      return NextResponse.json({ error: "估值必须是非负数（单位：分）" }, { status: 400 });
    }
    const validCategories = ["food", "daily", "digital", "other"];
    if (category && !validCategories.includes(category)) {
      return NextResponse.json({ error: "品类无效" }, { status: 400 });
    }
    const tags = Array.isArray(allergenTags) ? allergenTags.filter((t) => typeof t === "string" && t.trim()) : [];

    // 校验初始库存条目
    if (initialInventory && !Array.isArray(initialInventory)) {
      return NextResponse.json({ error: "initialInventory 必须是数组" }, { status: 400 });
    }
    for (const inv of initialInventory || []) {
      if (!inv.warehouseId || typeof inv.qtyTotal !== "number" || inv.qtyTotal < 0) {
        return NextResponse.json({ error: "初始库存条目格式错误" }, { status: 400 });
      }
    }

    // 事务：建 Gift + 建对应 Inventory（qtyTotal>0 的才建）
    const gift = await prisma.$transaction(async (tx) => {
      const g = await tx.gift.create({
        data: {
          name: name.trim(),
          description: description?.trim() || null,
          imageUrl: imageUrl?.trim() || null,
          value,
          category: category || "other",
          allergenTags: JSON.stringify(tags),
        },
      });

      const invToCreate = (initialInventory || []).filter((i: any) => i.qtyTotal > 0);
      if (invToCreate.length > 0) {
        await tx.inventory.createMany({
          data: invToCreate.map((i: any) => ({
            giftId: g.id,
            warehouseId: i.warehouseId,
            qtyTotal: i.qtyTotal,
          })),
        });
      }

      return g;
    });

    return NextResponse.json({ ok: true, id: gift.id });
  } catch (e: any) {
    if (e.message === "UNAUTHORIZED") return NextResponse.json({ error: "请先登录" }, { status: 401 });
    if (e.message === "FORBIDDEN") return NextResponse.json({ error: "权限不足" }, { status: 403 });
    console.error(e);
    return NextResponse.json({ error: e.message || "服务器错误" }, { status: 500 });
  }
}
