import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, Clock, CheckCircle2, Users, Package } from "lucide-react";
import { formatDate } from "@/lib/utils";
import { parseRule, describeRule } from "@/lib/eligibility";
import { CampaignActions } from "./actions";
import { ImportEligibilityDialog } from "@/components/admin/import-eligibility-dialog";
import { ManualClaimDialog } from "@/components/admin/manual-claim-dialog";

export const dynamic = "force-dynamic";

const STATUS_META: Record<string, { label: string; variant: "default" | "success" | "muted" | "warning" }> = {
  draft: { label: "草稿", variant: "muted" },
  published: { label: "已发布", variant: "default" },
  active: { label: "进行中", variant: "success" },
  closed: { label: "已结束", variant: "muted" },
};

export default async function CampaignDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const c = await prisma.campaign.findUnique({
    where: { id },
    include: {
      campaignGifts: { include: { gift: true } },
      _count: { select: { eligibilities: true, claims: true } },
    },
  });
  if (!c) notFound();

  const [reservedCount, claimedCount, byBuilding, byGift, recentClaims] = await Promise.all([
    prisma.claim.count({ where: { campaignId: id, status: "reserved" } }),
    prisma.claim.count({ where: { campaignId: id, status: "claimed" } }),
    prisma.claim.groupBy({
      by: ["warehouseId"],
      where: { campaignId: id },
      _count: { _all: true },
    }),
    prisma.claim.groupBy({
      by: ["giftId", "status"],
      where: { campaignId: id },
      _count: { _all: true },
    }),
    prisma.claim.findMany({
      where: { campaignId: id },
      orderBy: { reservedAt: "desc" },
      take: 8,
      include: { employee: true, gift: true, warehouse: { include: { building: true } } },
    }),
  ]);

  const warehouses = await prisma.warehouse.findMany({ include: { building: true } });
  const buildingClaimMap = new Map(byBuilding.map((b) => [b.warehouseId, b._count._all]));
  const giftStats = new Map<string, { name: string; emoji: string; reserved: number; claimed: number }>();
  for (const cg of c.campaignGifts) {
    giftStats.set(cg.giftId, { name: cg.gift.name, emoji: cg.gift.imageUrl || "🎁", reserved: 0, claimed: 0 });
  }
  for (const g of byGift) {
    const s = giftStats.get(g.giftId);
    if (!s) continue;
    if (g.status === "reserved") s.reserved += g._count._all;
    else if (g.status === "claimed") s.claimed += g._count._all;
  }

  const meta = STATUS_META[c.status] || STATUS_META.draft;
  const total = c._count.eligibilities;
  const claimed = claimedCount;
  const claimedPct = total > 0 ? Math.round((claimed / total) * 100) : 0;

  const giftOptions = c.campaignGifts.map((cg) => ({
    id: cg.giftId,
    name: cg.gift.name,
    emoji: cg.gift.imageUrl || "🎁",
  }));
  const warehouseOptions = warehouses.map((w) => ({ id: w.id, name: w.building.name }));

  return (
    <div className="p-8 max-w-6xl">
      <Link
        href="/admin/campaigns"
        className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1 mb-3"
      >
        <ChevronLeft className="w-4 h-4" /> 返回活动列表
      </Link>

      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-semibold">{c.name}</h1>
            <Badge variant={meta.variant}>{meta.label}</Badge>
          </div>
          {c.description && <p className="text-sm text-muted-foreground mt-1">{c.description}</p>}
          <div className="text-xs text-muted-foreground mt-2">
            {formatDate(c.startAt)} ~ {formatDate(c.endAt)}
          </div>
        </div>
        <div className="flex flex-col items-end gap-2">
          <CampaignActions id={c.id} status={c.status} canDelete={claimed === 0} />
          <div className="flex items-center gap-2">
            <ImportEligibilityDialog campaignId={c.id} currentCount={total} />
            <ManualClaimDialog
              campaignId={c.id}
              gifts={giftOptions}
              warehouses={warehouseOptions}
              multiSelect={c.selectionMode === "choose_one"}
            />
          </div>
        </div>
      </div>

      {/* 总览 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
        <Mini icon={Users} label="资格人数" value={total} />
        <Mini icon={Clock} label="已预约" value={reservedCount} tint="amber" />
        <Mini icon={CheckCircle2} label="已领取" value={claimed} tint="green" />
        <Mini icon={Package} label="完成率" value={`${claimedPct}%`} tint="blue" />
      </div>

      {/* 进度条 */}
      <Card className="mt-6">
        <CardContent className="p-6">
          <div className="flex items-center justify-between text-sm mb-3">
            <div className="font-medium">领取进度</div>
            <div className="text-muted-foreground">
              {claimed} / {total} 人已领（{reservedCount} 人已预约）
            </div>
          </div>
          <div className="h-3 rounded-full bg-muted overflow-hidden relative">
            <div className="absolute inset-y-0 left-0 bg-warning/40" style={{ width: total ? `${((claimed + reservedCount) / total) * 100}%` : "0%" }} />
            <div className="absolute inset-y-0 left-0 bg-primary rounded-full" style={{ width: total ? `${claimedPct}%` : "0%" }} />
          </div>
          <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-primary" /> 已领取</span>
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-warning/60" /> 预约中</span>
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-muted" /> 未领取</span>
          </div>
        </CardContent>
      </Card>

      <div className="grid lg:grid-cols-2 gap-4 mt-4">
        {/* 配置详情 */}
        <Card>
          <CardContent className="p-6 space-y-3">
            <div className="font-semibold">配置详情</div>
            <Row label="发放模式">{c.selectionMode === "choose_one" ? "多选一" : "固定礼物"}</Row>
            <Row label="资格人群">{describeRule(parseRule(c.eligibilityRule))}</Row>
            <div>
              <div className="text-xs text-muted-foreground mb-1.5">关联礼物</div>
              <div className="flex flex-wrap gap-2">
                {c.campaignGifts.map((cg) => (
                  <div key={cg.giftId} className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-muted text-sm">
                    <span>{cg.gift.imageUrl || "🎁"}</span>
                    {cg.gift.name}
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 按楼宇分布 */}
        <Card>
          <CardContent className="p-6">
            <div className="font-semibold mb-3">按楼宇分布</div>
            <div className="space-y-2">
              {warehouses.map((w) => {
                const n = buildingClaimMap.get(w.id) || 0;
                const max = Math.max(...Array.from(buildingClaimMap.values()), 1);
                const pct = Math.round((n / max) * 100);
                return (
                  <div key={w.id}>
                    <div className="flex items-center justify-between text-sm">
                      <span>{w.building.name}</span>
                      <span className="text-muted-foreground">{n} 人</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-muted mt-1 overflow-hidden">
                      <div className="h-full bg-primary rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* 按 SKU 分布（多选一时有意义） */}
        <Card>
          <CardContent className="p-6">
            <div className="font-semibold mb-3">按礼物分布</div>
            <div className="space-y-2">
              {Array.from(giftStats.entries()).map(([id, s]) => {
                const total = s.reserved + s.claimed;
                return (
                  <div key={id} className="flex items-center gap-3 text-sm">
                    <span className="text-xl">{s.emoji}</span>
                    <span className="flex-1 truncate">{s.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {s.claimed} 已领 / {s.reserved} 预约
                    </span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* 最近活动 */}
        <Card>
          <CardContent className="p-6">
            <div className="font-semibold mb-3">最近领取</div>
            {recentClaims.length === 0 ? (
              <div className="text-sm text-muted-foreground py-4 text-center">还没有人领取</div>
            ) : (
              <div className="space-y-2">
                {recentClaims.map((cl) => (
                  <div key={cl.id} className="flex items-center gap-3 text-sm">
                    <span className="text-xl">{cl.gift.imageUrl || "🎁"}</span>
                    <div className="flex-1 min-w-0">
                      <div className="truncate">{cl.employee.name}</div>
                      <div className="text-xs text-muted-foreground truncate">
                        {cl.warehouse.building.name} · {cl.gift.name}
                      </div>
                    </div>
                    <Badge variant={cl.status === "claimed" ? "success" : "warning"}>
                      {cl.status === "claimed" ? "已领" : "预约"}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Mini({ icon: Icon, label, value, tint = "gray" }: { icon: any; label: string; value: any; tint?: string }) {
  const tints: Record<string, string> = {
    gray: "bg-slate-100 text-slate-600",
    blue: "bg-blue-50 text-blue-600",
    green: "bg-emerald-50 text-emerald-600",
    amber: "bg-amber-50 text-amber-600",
  };
  return (
    <Card>
      <CardContent className="p-4 flex items-center gap-3">
        <div className={`w-9 h-9 rounded-lg ${tints[tint]} flex items-center justify-center`}>
          <Icon className="w-4 h-4" />
        </div>
        <div>
          <div className="text-xs text-muted-foreground">{label}</div>
          <div className="text-xl font-semibold">{value}</div>
        </div>
      </CardContent>
    </Card>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline gap-3 text-sm">
      <div className="w-24 text-muted-foreground text-xs">{label}</div>
      <div className="flex-1">{children}</div>
    </div>
  );
}
