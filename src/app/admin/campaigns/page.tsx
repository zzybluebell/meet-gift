import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Empty } from "@/components/ui/empty";
import { PageHeader } from "@/components/admin/page-header";
import { formatDate } from "@/lib/utils";
import { parseRule, describeRule } from "@/lib/eligibility";
import { Megaphone, Plus } from "lucide-react";

export const dynamic = "force-dynamic";

const STATUS_META: Record<string, { label: string; variant: "default" | "success" | "muted" | "warning" }> = {
  draft: { label: "草稿", variant: "muted" },
  published: { label: "已发布", variant: "default" },
  active: { label: "进行中", variant: "success" },
  closed: { label: "已结束", variant: "muted" },
};

const HOLIDAY_LABEL: Record<string, string> = {
  mid_autumn: "中秋",
  dragon_boat: "端午",
  spring: "春节",
  womens: "女神节",
  childrens: "儿童节",
  birthday: "生日",
  tenure: "司庆",
  other: "其他",
};

export default async function CampaignsPage() {
  const campaigns = await prisma.campaign.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      campaignGifts: { include: { gift: true } },
      _count: { select: { eligibilities: true, claims: true } },
    },
  });

  return (
    <div className="p-8">
      <PageHeader
        title="活动批次"
        desc="一个活动 = 一次福利发放（节日/生日/司庆/慰问 等）"
        actions={
          <Button asChild>
            <Link href="/admin/campaigns/new">
              <Plus className="w-4 h-4" />
              创建活动
            </Link>
          </Button>
        }
      />

      {campaigns.length === 0 ? (
        <Card>
          <CardContent>
            <Empty
              icon={<Megaphone className="w-12 h-12" />}
              title="还没有活动批次"
              desc="创建第一个活动，开始你的节日福利发放"
              action={
                <Button asChild className="mt-2">
                  <Link href="/admin/campaigns/new">创建活动</Link>
                </Button>
              }
            />
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {campaigns.map((c) => {
            const claimedPct =
              c._count.eligibilities > 0
                ? Math.round((c._count.claims / c._count.eligibilities) * 100)
                : 0;
            const meta = STATUS_META[c.status] || STATUS_META.draft;
            const claimed = c._count.claims;
            const total = c._count.eligibilities;
            return (
              <Link key={c.id} href={`/admin/campaigns/${c.id}`}>
                <Card className="hover:border-primary/40 hover:shadow-md transition-all cursor-pointer">
                  <CardContent className="p-5">
                    <div className="flex items-start gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold">{c.name}</span>
                          <Badge variant={meta.variant}>{meta.label}</Badge>
                          <Badge variant="outline">{HOLIDAY_LABEL[c.holidayType] || c.holidayType}</Badge>
                          <Badge variant="muted">
                            {c.selectionMode === "choose_one" ? "多选一" : "固定礼物"}
                          </Badge>
                        </div>
                        {c.description && (
                          <div className="text-sm text-muted-foreground mt-1 line-clamp-1">{c.description}</div>
                        )}
                        <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-muted-foreground mt-2">
                          <span>{formatDate(c.startAt)} ~ {formatDate(c.endAt)}</span>
                          <span>资格人群：{describeRule(parseRule(c.eligibilityRule))}</span>
                          <span>礼物：{c.campaignGifts.map((cg) => cg.gift.name).join(" / ") || "—"}</span>
                        </div>
                      </div>
                      <div className="w-48 shrink-0">
                        <div className="flex items-center justify-between text-xs mb-1.5">
                          <span className="text-muted-foreground">领取进度</span>
                          <span className="font-semibold">{claimed}/{total}</span>
                        </div>
                        <div className="h-2 rounded-full bg-muted overflow-hidden">
                          <div className="h-full bg-primary rounded-full" style={{ width: `${claimedPct}%` }} />
                        </div>
                        <div className="text-[11px] text-muted-foreground mt-1.5 text-right">{claimedPct}%</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
