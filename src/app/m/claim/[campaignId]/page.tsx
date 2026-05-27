import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { ChevronLeft } from "lucide-react";
import { ClaimFlow } from "./flow";

export const dynamic = "force-dynamic";

export default async function ClaimPage({ params }: { params: Promise<{ campaignId: string }> }) {
  const { campaignId } = await params;
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const [campaign, eligibility, existingClaim, warehouses] = await Promise.all([
    prisma.campaign.findUnique({
      where: { id: campaignId },
      include: { campaignGifts: { include: { gift: true } } },
    }),
    prisma.eligibility.findUnique({
      where: { campaignId_employeeId: { campaignId, employeeId: user.id } },
    }),
    prisma.claim.findUnique({
      where: { campaignId_employeeId: { campaignId, employeeId: user.id } },
      include: { gift: true, warehouse: { include: { building: true } } },
    }),
    prisma.warehouse.findMany({
      include: { building: true, inventories: true },
    }),
  ]);

  if (!campaign) notFound();
  if (!eligibility) {
    return (
      <div className="px-4 py-8 text-center">
        <Link href="/m" className="inline-flex items-center gap-1 text-sm text-muted-foreground mb-4">
          <ChevronLeft className="w-4 h-4" /> 返回
        </Link>
        <div className="py-12">
          <div className="text-4xl mb-3">🤷</div>
          <div className="font-medium">你不在本次福利的资格名单中</div>
          <div className="text-sm text-muted-foreground mt-1">如有疑问请联系行政同事</div>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 py-4">
      <Link href="/m" className="inline-flex items-center gap-1 text-sm text-muted-foreground mb-3">
        <ChevronLeft className="w-4 h-4" /> 返回
      </Link>
      <h1 className="text-xl font-semibold">{campaign.name}</h1>
      {campaign.description && <p className="text-sm text-muted-foreground mt-1">{campaign.description}</p>}

      <ClaimFlow
        campaign={{
          id: campaign.id,
          selectionMode: campaign.selectionMode,
          endAt: campaign.endAt.toISOString(),
          gifts: campaign.campaignGifts.map((cg) => ({
            id: cg.giftId,
            name: cg.gift.name,
            description: cg.gift.description,
            imageUrl: cg.gift.imageUrl,
            allergenTags: cg.gift.allergenTags,
          })),
        }}
        warehouses={warehouses.map((w) => ({
          id: w.id,
          name: w.building.name,
          inventoryByGift: w.inventories.reduce((acc, inv) => {
            acc[inv.giftId] = inv.qtyTotal - inv.qtyReserved - inv.qtyClaimed;
            return acc;
          }, {} as Record<string, number>),
        }))}
        defaultWarehouseId={warehouses.find((w) => w.buildingId === user.buildingId)?.id || null}
        existingClaim={
          existingClaim
            ? {
                id: existingClaim.id,
                status: existingClaim.status,
                claimCode: existingClaim.claimCode,
                qrToken: existingClaim.qrToken,
                giftId: existingClaim.giftId,
                giftName: existingClaim.gift.name,
                giftImageUrl: existingClaim.gift.imageUrl,
                warehouseId: existingClaim.warehouseId,
                warehouseName: existingClaim.warehouse.building.name,
              }
            : null
        }
      />
    </div>
  );
}
