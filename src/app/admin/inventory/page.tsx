import { prisma } from "@/lib/prisma";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/admin/page-header";
import { InventoryEditor } from "./editor";

export const dynamic = "force-dynamic";

export default async function InventoryPage() {
  const [gifts, warehouses, inventories] = await Promise.all([
    prisma.gift.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.warehouse.findMany({ include: { building: true }, orderBy: { id: "asc" } }),
    prisma.inventory.findMany(),
  ]);

  // 构建矩阵：gift × warehouse
  const matrix = new Map<string, typeof inventories[number]>();
  for (const inv of inventories) {
    matrix.set(`${inv.giftId}_${inv.warehouseId}`, inv);
  }

  // 总计
  const totals = gifts.map((g) => {
    let total = 0,
      reserved = 0,
      claimed = 0;
    for (const wh of warehouses) {
      const inv = matrix.get(`${g.id}_${wh.id}`);
      if (inv) {
        total += inv.qtyTotal;
        reserved += inv.qtyReserved;
        claimed += inv.qtyClaimed;
      }
    }
    return { giftId: g.id, total, reserved, claimed, available: total - reserved - claimed };
  });

  return (
    <div className="p-8">
      <PageHeader title="库存管理" desc="按礼物 × 分仓维度查看与调整库存（全局共享 + 软锁定）" />

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/30">
                <th className="text-left px-4 py-3 font-medium w-64">礼物 SKU</th>
                {warehouses.map((wh) => (
                  <th key={wh.id} className="text-center px-4 py-3 font-medium min-w-[120px]">
                    {wh.building.name}
                  </th>
                ))}
                <th className="text-right px-4 py-3 font-medium w-32">总计</th>
              </tr>
            </thead>
            <tbody>
              {gifts.map((g) => {
                const total = totals.find((t) => t.giftId === g.id)!;
                return (
                  <tr key={g.id} className="border-b last:border-0 hover:bg-muted/20">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="text-xl">{g.imageUrl || "🎁"}</span>
                        <div>
                          <div className="font-medium">{g.name}</div>
                          <div className="text-xs text-muted-foreground">{g.category}</div>
                        </div>
                      </div>
                    </td>
                    {warehouses.map((wh) => {
                      const inv = matrix.get(`${g.id}_${wh.id}`);
                      return (
                        <td key={wh.id} className="px-4 py-3 text-center">
                          <InventoryEditor
                            giftId={g.id}
                            warehouseId={wh.id}
                            qtyTotal={inv?.qtyTotal ?? 0}
                            qtyReserved={inv?.qtyReserved ?? 0}
                            qtyClaimed={inv?.qtyClaimed ?? 0}
                          />
                        </td>
                      );
                    })}
                    <td className="px-4 py-3 text-right">
                      <div className="font-semibold">{total.available}</div>
                      <div className="text-[11px] text-muted-foreground mt-0.5">
                        预约 {total.reserved} / 已发 {total.claimed}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <div className="mt-6 text-xs text-muted-foreground">
        每格大数字 = 可领（总量 − 预约 − 已发）。可领 ≤ 5 时数字变琥珀橙，提示低库存。点击数字可改总量。
      </div>
    </div>
  );
}
