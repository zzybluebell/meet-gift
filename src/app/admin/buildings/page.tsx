import { prisma } from "@/lib/prisma";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/admin/page-header";
import { Building2, MapPin } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function BuildingsPage() {
  const buildings = await prisma.building.findMany({
    include: {
      _count: { select: { employees: true } },
      warehouses: {
        include: {
          manager: true,
          _count: { select: { inventories: true, claims: true } },
        },
      },
    },
    orderBy: { name: "asc" },
  });

  return (
    <div className="p-8">
      <PageHeader title="楼宇分仓" desc="多楼宇分布式发放，每栋楼一个分仓" />

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {buildings.map((b) => {
          const wh = b.warehouses[0];
          return (
            <Card key={b.id}>
              <CardContent className="p-6 space-y-4">
                <div>
                  <div className="flex items-center gap-2">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                      <Building2 className="w-5 h-5" />
                    </div>
                    <div className="font-semibold">{b.name}</div>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-2">
                    <MapPin className="w-3 h-3" />
                    {b.address}
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-lg bg-muted/40 p-3">
                    <div className="text-lg font-semibold">{b._count.employees}</div>
                    <div className="text-[11px] text-muted-foreground mt-0.5">员工</div>
                  </div>
                  <div className="rounded-lg bg-muted/40 p-3">
                    <div className="text-lg font-semibold">{wh?._count.inventories || 0}</div>
                    <div className="text-[11px] text-muted-foreground mt-0.5">SKU 库存</div>
                  </div>
                  <div className="rounded-lg bg-muted/40 p-3">
                    <div className="text-lg font-semibold">{wh?._count.claims || 0}</div>
                    <div className="text-[11px] text-muted-foreground mt-0.5">历史发放</div>
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">分仓负责人</span>
                  {wh?.manager ? (
                    <Badge variant="default">{wh.manager.name}</Badge>
                  ) : (
                    <span className="text-muted-foreground">未指派</span>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
