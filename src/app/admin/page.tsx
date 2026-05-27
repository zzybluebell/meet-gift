import { prisma } from "@/lib/prisma";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import {
  Megaphone,
  Users,
  Package,
  AlertTriangle,
  ArrowRight,
  TrendingUp,
  CheckCircle2,
  Clock,
} from "lucide-react";
import { formatDate } from "@/lib/utils";
import { ExpireButton } from "@/components/admin/expire-button";

export const dynamic = "force-dynamic";

async function getStats() {
  const [
    activeCampaigns,
    totalEmployees,
    totalGifts,
    inventories,
    pendingClaims,
    claimedTotal,
  ] = await Promise.all([
    prisma.campaign.count({ where: { status: "active" } }),
    prisma.employee.count({ where: { status: "active" } }),
    prisma.gift.count(),
    prisma.inventory.findMany({ include: { gift: true, warehouse: { include: { building: true } } } }),
    prisma.claim.count({ where: { status: "reserved" } }),
    prisma.claim.count({ where: { status: "claimed" } }),
  ]);

  const lowStock = inventories.filter((i) => {
    const available = i.qtyTotal - i.qtyReserved - i.qtyClaimed;
    return available <= 5 && i.qtyTotal > 0;
  });

  const campaignList = await prisma.campaign.findMany({
    orderBy: { createdAt: "desc" },
    take: 5,
    include: {
      _count: { select: { eligibilities: true, claims: true } },
    },
  });

  return { activeCampaigns, totalEmployees, totalGifts, lowStock, pendingClaims, claimedTotal, campaignList };
}

const STATUS_META: Record<string, { label: string; variant: "default" | "success" | "muted" | "warning" }> = {
  draft: { label: "草稿", variant: "muted" },
  published: { label: "已发布", variant: "default" },
  active: { label: "进行中", variant: "success" },
  closed: { label: "已结束", variant: "muted" },
};

export default async function AdminDashboard() {
  const s = await getStats();

  return (
    <div className="p-8 space-y-8">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold">看板</h1>
          <p className="text-sm text-muted-foreground mt-1">全公司福利发放运行状态</p>
        </div>
        <div className="flex items-center gap-3">
          <ExpireButton />
          <Link
            href="/admin/campaigns/new"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90"
          >
            + 创建活动
          </Link>
        </div>
      </div>

      {/* 核心指标 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Megaphone} label="进行中的活动" value={s.activeCampaigns} hint="正在领取窗口期" tint="blue" />
        <StatCard icon={Clock} label="待领取" value={s.pendingClaims} hint="已预约未核销" tint="amber" />
        <StatCard icon={CheckCircle2} label="累计已发放" value={s.claimedTotal} hint="所有批次合计" tint="green" />
        <StatCard
          icon={AlertTriangle}
          label="缺货 SKU"
          value={s.lowStock.length}
          hint="库存 ≤ 5"
          tint={s.lowStock.length > 0 ? "red" : "gray"}
        />
      </div>

      {/* 活动列表 */}
      <Card>
        <CardContent className="p-0">
          <div className="px-6 py-4 border-b flex items-center justify-between">
            <div>
              <div className="font-semibold">最近活动</div>
              <div className="text-xs text-muted-foreground mt-0.5">最新创建的 5 个批次</div>
            </div>
            <Link
              href="/admin/campaigns"
              className="text-xs text-primary hover:underline inline-flex items-center gap-1"
            >
              全部活动 <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="divide-y">
            {s.campaignList.length === 0 && (
              <div className="px-6 py-10 text-center text-sm text-muted-foreground">
                还没有活动，<Link href="/admin/campaigns/new" className="text-primary hover:underline">立即创建</Link>
              </div>
            )}
            {s.campaignList.map((c) => {
              const claimedPct =
                c._count.eligibilities > 0
                  ? Math.round((c._count.claims / c._count.eligibilities) * 100)
                  : 0;
              const meta = STATUS_META[c.status] || STATUS_META.draft;
              return (
                <Link
                  key={c.id}
                  href={`/admin/campaigns/${c.id}`}
                  className="flex items-center gap-4 px-6 py-4 hover:bg-muted/40 transition-colors group"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium truncate">{c.name}</span>
                      <Badge variant={meta.variant}>{meta.label}</Badge>
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {formatDate(c.startAt)} ~ {formatDate(c.endAt)}
                    </div>
                  </div>
                  <div className="w-40 hidden md:block">
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-muted-foreground">领取进度</span>
                      <span className="font-semibold">{claimedPct}%</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full bg-primary rounded-full transition-all"
                        style={{ width: `${claimedPct}%` }}
                      />
                    </div>
                    <div className="text-[11px] text-muted-foreground mt-1">
                      {c._count.claims} / {c._count.eligibilities} 人
                    </div>
                  </div>
                  <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-foreground group-hover:translate-x-0.5 transition-all" />
                </Link>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* 缺货预警 */}
      {s.lowStock.length > 0 && (
        <Card>
          <CardContent className="p-0">
            <div className="px-6 py-4 border-b">
              <div className="font-semibold flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-warning" />
                缺货预警（≤ 5）
              </div>
              <div className="text-xs text-muted-foreground mt-0.5">建议尽快调拨或补货</div>
            </div>
            <div className="divide-y">
              {s.lowStock.slice(0, 5).map((i) => {
                const available = i.qtyTotal - i.qtyReserved - i.qtyClaimed;
                return (
                  <div key={i.id} className="px-6 py-3 flex items-center gap-4 text-sm">
                    <div className="text-2xl">{i.gift.imageUrl || "🎁"}</div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{i.gift.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {i.warehouse.building.name}
                      </div>
                    </div>
                    <Badge variant="warning">余 {available}</Badge>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  hint,
  tint,
}: {
  icon: any;
  label: string;
  value: number | string;
  hint?: string;
  tint: "blue" | "green" | "amber" | "red" | "gray";
}) {
  const tints: Record<string, string> = {
    blue: "bg-blue-50 text-blue-600",
    green: "bg-emerald-50 text-emerald-600",
    amber: "bg-amber-50 text-amber-600",
    red: "bg-rose-50 text-rose-600",
    gray: "bg-slate-100 text-slate-500",
  };
  return (
    <Card>
      <CardContent className="p-5 flex items-start gap-3">
        <div className={`w-10 h-10 rounded-lg ${tints[tint]} flex items-center justify-center`}>
          <Icon className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-xs text-muted-foreground">{label}</div>
          <div className="text-2xl font-semibold mt-1 leading-none">{value}</div>
          {hint && <div className="text-[11px] text-muted-foreground mt-1.5">{hint}</div>}
        </div>
      </CardContent>
    </Card>
  );
}
