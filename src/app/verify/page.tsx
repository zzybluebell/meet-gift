import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { Card, CardContent } from "@/components/ui/card";
import { VerifyClient } from "./client";

export const dynamic = "force-dynamic";

export default async function VerifyPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  // 当前用户所在仓库
  const wh = await prisma.warehouse.findUnique({
    where: { buildingId: user.buildingId ?? "" },
    include: {
      building: true,
      inventories: { include: { gift: true } },
      claims: {
        where: { status: "reserved" },
        orderBy: { reservedAt: "desc" },
        take: 50,
        include: { employee: true, gift: true, campaign: true },
      },
    },
  });

  if (!wh) {
    return (
      <div className="px-4 py-8">
        <Card>
          <CardContent className="py-10 text-center">
            <div className="text-4xl mb-2">⚠️</div>
            <div className="font-medium">未分配到分仓</div>
            <div className="text-sm text-muted-foreground mt-1">请联系行政管理员</div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const pendingCount = wh.claims.length;
  const todayClaimedCount = await prisma.claim.count({
    where: {
      warehouseId: wh.id,
      status: "claimed",
      claimedAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) },
    },
  });

  return (
    <VerifyClient
      warehouseName={wh.building.name}
      pendingClaims={wh.claims.map((c) => ({
        id: c.id,
        claimCode: c.claimCode,
        employeeName: c.employee.name,
        employeeNo: c.employee.employeeNo,
        giftName: c.gift.name,
        giftEmoji: c.gift.imageUrl || "🎁",
        campaignName: c.campaign.name,
        reservedAt: c.reservedAt.toISOString(),
      }))}
      stats={{
        pending: pendingCount,
        todayClaimed: todayClaimedCount,
        inventories: wh.inventories.map((i) => ({
          giftName: i.gift.name,
          emoji: i.gift.imageUrl || "🎁",
          available: i.qtyTotal - i.qtyReserved - i.qtyClaimed,
          reserved: i.qtyReserved,
          claimed: i.qtyClaimed,
        })),
      }}
    />
  );
}
