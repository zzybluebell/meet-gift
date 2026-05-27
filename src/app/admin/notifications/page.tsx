import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Empty } from "@/components/ui/empty";
import { PageHeader } from "@/components/admin/page-header";
import { NotifyActions } from "./actions";
import { Bell, MailCheck, Eye, MousePointer2, PartyPopper, Send } from "lucide-react";
import { TYPE_LABEL, NotifMeta } from "@/lib/notifications";

export const dynamic = "force-dynamic";

export default async function NotificationsPage() {
  // 拉所有进行中 / 已发布的活动
  const campaigns = await prisma.campaign.findMany({
    where: { status: { in: ["active", "closed", "published"] } },
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { eligibilities: true } },
    },
  });

  // 每个活动的通知漏斗
  const funnels = await Promise.all(
    campaigns.map(async (c) => {
      const [byType, byStatus, byChannel, claimedCount] = await Promise.all([
        prisma.notification.groupBy({
          by: ["type"],
          where: { campaignId: c.id },
          _count: { _all: true },
        }),
        prisma.notification.groupBy({
          by: ["status"],
          where: { campaignId: c.id },
          _count: { _all: true },
        }),
        prisma.notification.groupBy({
          by: ["channel"],
          where: { campaignId: c.id },
          _count: { _all: true },
        }),
        prisma.claim.count({ where: { campaignId: c.id, status: "claimed" } }),
      ]);
      return { campaign: c, byType, byStatus, byChannel, claimedCount };
    })
  );

  // 全局统计
  const totalSent = await prisma.notification.count({
    where: { status: { in: ["sent", "read", "clicked"] } },
  });
  const totalRead = await prisma.notification.count({
    where: { status: { in: ["read", "clicked"] } },
  });
  const totalClicked = await prisma.notification.count({ where: { status: "clicked" } });
  const totalFailed = await prisma.notification.count({ where: { status: "failed" } });
  const totalQueued = await prisma.notification.count({ where: { status: "queued" } });

  return (
    <div className="p-8">
      <PageHeader
        title="推送中心"
        desc="飞书 / 邮件触达 — 漏斗分析与手动催领"
        actions={<NotifyActions runCron={true} />}
      />

      {/* 全局漏斗 */}
      <div className="grid grid-cols-5 gap-3 mb-6">
        <FunnelCell label="已发送" icon={Send} value={totalSent} color="text-blue-600 bg-blue-50" />
        <FunnelCell
          label="已查看"
          icon={Eye}
          value={totalRead}
          sub={totalSent > 0 ? `${Math.round((totalRead / totalSent) * 100)}%` : "—"}
          color="text-emerald-600 bg-emerald-50"
        />
        <FunnelCell
          label="已点击"
          icon={MousePointer2}
          value={totalClicked}
          sub={totalSent > 0 ? `${Math.round((totalClicked / totalSent) * 100)}%` : "—"}
          color="text-purple-600 bg-purple-50"
        />
        <FunnelCell label="排队中" icon={Bell} value={totalQueued} color="text-amber-600 bg-amber-50" />
        <FunnelCell
          label="失败"
          icon={MailCheck}
          value={totalFailed}
          color={totalFailed > 0 ? "text-rose-600 bg-rose-50" : "text-muted-foreground bg-muted/50"}
        />
      </div>

      {/* 按活动 */}
      {funnels.length === 0 ? (
        <Empty icon={<Bell className="w-10 h-10" />} title="还没有活动" desc="去创建活动后会自动触达员工" />
      ) : (
        <div className="space-y-3">
          {funnels.map((f) => (
            <CampaignFunnelCard key={f.campaign.id} {...f} />
          ))}
        </div>
      )}
    </div>
  );
}

function FunnelCell({
  label,
  icon: Icon,
  value,
  sub,
  color,
}: {
  label: string;
  icon: any;
  value: number;
  sub?: string;
  color: string;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-muted-foreground">{label}</span>
          <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${color}`}>
            <Icon className="w-3.5 h-3.5" />
          </div>
        </div>
        <div className="text-2xl font-semibold tabular-nums">{value}</div>
        {sub && <div className="text-[11px] text-muted-foreground mt-0.5">{sub}</div>}
      </CardContent>
    </Card>
  );
}

function CampaignFunnelCard({
  campaign,
  byType,
  byStatus,
  byChannel,
  claimedCount,
}: {
  campaign: any;
  byType: { type: string; _count: { _all: number } }[];
  byStatus: { status: string; _count: { _all: number } }[];
  byChannel: { channel: string; _count: { _all: number } }[];
  claimedCount: number;
}) {
  const sentCount = byStatus
    .filter((s) => ["sent", "read", "clicked"].includes(s.status))
    .reduce((a, b) => a + b._count._all, 0);
  const readCount = byStatus
    .filter((s) => ["read", "clicked"].includes(s.status))
    .reduce((a, b) => a + b._count._all, 0);
  const clickedCount = byStatus.find((s) => s.status === "clicked")?._count._all || 0;
  const queued = byStatus.find((s) => s.status === "queued")?._count._all || 0;
  const failed = byStatus.find((s) => s.status === "failed")?._count._all || 0;

  const eligible = campaign._count.eligibilities;
  // 转化率：claimed / 推送过的目标人数（去重看 initial 类型）
  const initialSent = byType.find((t) => t.type === "initial")?._count._all || 0;
  const reachRate = eligible > 0 ? Math.round((initialSent / eligible) * 100) : 0;
  const readRate = sentCount > 0 ? Math.round((readCount / sentCount) * 100) : 0;
  const clickRate = sentCount > 0 ? Math.round((clickedCount / sentCount) * 100) : 0;
  const claimRate = eligible > 0 ? Math.round((claimedCount / eligible) * 100) : 0;

  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-start justify-between mb-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Link href={`/admin/campaigns/${campaign.id}`} className="font-medium hover:underline">
                {campaign.name}
              </Link>
              <StatusBadge status={campaign.status} />
            </div>
            <div className="text-xs text-muted-foreground">
              资格 {eligible} 人 · 已领 {claimedCount} 人 · 截止 {new Date(campaign.endAt).toLocaleString("zh-CN")}
            </div>
          </div>
          <NotifyActions campaignId={campaign.id} runCron={false} />
        </div>

        {/* 漏斗条 */}
        <div className="space-y-2 mb-4">
          <FunnelBar label="触达" value={initialSent} total={eligible} rate={reachRate} color="bg-blue-500" />
          <FunnelBar label="查看" value={readCount} total={eligible} rate={readRate} color="bg-emerald-500" baseLabel="送达" />
          <FunnelBar label="点击" value={clickedCount} total={eligible} rate={clickRate} color="bg-purple-500" baseLabel="送达" />
          <FunnelBar label="领取" value={claimedCount} total={eligible} rate={claimRate} color="bg-rose-500" highlight />
        </div>

        {/* 类型分布 */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2 pt-3 border-t">
          {byType.map((t) => (
            <div key={t.type} className="text-xs flex items-center justify-between bg-muted/40 rounded-md px-2 py-1.5">
              <span className="text-muted-foreground">{TYPE_LABEL[t.type as keyof typeof TYPE_LABEL] || t.type}</span>
              <span className="font-mono tabular-nums">{t._count._all}</span>
            </div>
          ))}
          {queued > 0 && (
            <div className="text-xs flex items-center justify-between bg-amber-50 text-amber-700 rounded-md px-2 py-1.5">
              <span>排队中</span>
              <span className="font-mono">{queued}</span>
            </div>
          )}
          {failed > 0 && (
            <div className="text-xs flex items-center justify-between bg-rose-50 text-rose-700 rounded-md px-2 py-1.5">
              <span>失败</span>
              <span className="font-mono">{failed}</span>
            </div>
          )}
        </div>

        {/* 渠道分布 */}
        {byChannel.length > 0 && (
          <div className="flex items-center gap-2 mt-3 text-xs text-muted-foreground">
            <span>渠道：</span>
            {byChannel.map((c) => (
              <span key={c.channel} className="px-2 py-0.5 rounded-full border bg-card">
                {NotifMeta.CHANNEL_LABEL[c.channel as keyof typeof NotifMeta.CHANNEL_LABEL] || c.channel} · {c._count._all}
              </span>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function FunnelBar({
  label,
  value,
  total,
  rate,
  color,
  baseLabel,
  highlight,
}: {
  label: string;
  value: number;
  total: number;
  rate: number;
  color: string;
  baseLabel?: string;
  highlight?: boolean;
}) {
  const pct = total > 0 ? Math.min(100, (value / total) * 100) : 0;
  return (
    <div>
      <div className="flex items-center justify-between text-xs mb-1">
        <span className={highlight ? "font-medium" : "text-muted-foreground"}>{label}</span>
        <span className="tabular-nums">
          <span className={highlight ? "font-semibold" : ""}>{value}</span>
          <span className="text-muted-foreground"> / {total} · {rate}%{baseLabel ? `（占${baseLabel}）` : "（占资格）"}</span>
        </span>
      </div>
      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
        <div className={`h-full transition-all ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  if (status === "active") return <Badge variant="success">进行中</Badge>;
  if (status === "published") return <Badge variant="default">已发布</Badge>;
  if (status === "closed") return <Badge variant="muted">已结束</Badge>;
  return <Badge variant="muted">{status}</Badge>;
}
