import { prisma } from "@/lib/prisma";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/admin/page-header";
import { Empty } from "@/components/ui/empty";
import { NewGiftButton, EditGiftButton } from "@/components/admin/gift-dialog";
import { Package } from "lucide-react";

export const dynamic = "force-dynamic";

const CATEGORY_LABEL: Record<string, string> = {
  food: "食品",
  daily: "日用",
  digital: "数码",
  other: "其他",
};

export default async function GiftsPage() {
  const [gifts, warehouses] = await Promise.all([
    prisma.gift.findMany({
      include: {
        _count: { select: { inventories: true, claims: true, campaignGifts: true } },
        inventories: true,
      },
      orderBy: { createdAt: "asc" },
    }),
    prisma.warehouse.findMany({ include: { building: true }, orderBy: { id: "asc" } }),
  ]);

  const warehousesForDialog = warehouses.map((w) => ({
    id: w.id,
    buildingName: w.building.name,
  }));

  return (
    <div className="p-8">
      <PageHeader
        title="礼物 SKU"
        desc="所有可发的礼物商品池，跨活动复用。新增时可一并录入各分仓初始库存"
        actions={<NewGiftButton warehouses={warehousesForDialog} />}
      />

      {gifts.length === 0 ? (
        <Card>
          <CardContent>
            <Empty
              icon={<Package className="w-12 h-12" />}
              title="还没有礼物 SKU"
              desc="点击右上角「新增礼物」录入第一款商品"
            />
          </CardContent>
        </Card>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {gifts.map((g) => {
            const totalStock = g.inventories.reduce((acc, i) => acc + i.qtyTotal, 0);
            const claimedTotal = g.inventories.reduce((acc, i) => acc + i.qtyClaimed, 0);
            const reservedTotal = g.inventories.reduce((acc, i) => acc + i.qtyReserved, 0);
            const available = totalStock - claimedTotal - reservedTotal;
            const allergens: string[] = JSON.parse(g.allergenTags || "[]");

            return (
              <Card key={g.id} className="hover:shadow-sm transition-shadow">
                <CardContent className="p-6 space-y-4">
                  <div className="flex items-start gap-3">
                    <div className="text-4xl">{g.imageUrl || "🎁"}</div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold">{g.name}</div>
                      <div className="text-xs text-muted-foreground mt-1 line-clamp-2">
                        {g.description || "—"}
                      </div>
                    </div>
                    <EditGiftButton
                      gift={{
                        id: g.id,
                        name: g.name,
                        description: g.description,
                        imageUrl: g.imageUrl,
                        value: g.value,
                        category: g.category,
                        allergenTags: allergens,
                      }}
                      warehouses={warehousesForDialog}
                    />
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline">{CATEGORY_LABEL[g.category] || g.category}</Badge>
                    <Badge variant="muted">¥ {(g.value / 100).toFixed(0)}</Badge>
                    {allergens.map((a) => (
                      <Badge key={a} variant="warning">过敏：{a}</Badge>
                    ))}
                  </div>

                  <div className="grid grid-cols-4 gap-2 text-center">
                    <Stat label="可领" value={available} />
                    <Stat label="预约" value={reservedTotal} />
                    <Stat label="已发" value={claimedTotal} />
                    <Stat label="活动" value={g._count.campaignGifts} />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg bg-muted/40 py-2">
      <div className="text-sm font-semibold tabular-nums">{value}</div>
      <div className="text-[10px] text-muted-foreground">{label}</div>
    </div>
  );
}
