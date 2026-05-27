import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Empty } from "@/components/ui/empty";
import { Gift as GiftIcon, Clock, CheckCircle2, ChevronRight, Sparkles } from "lucide-react";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

const HOLIDAY_EMOJI: Record<string, string> = {
  mid_autumn: "🌕",
  dragon_boat: "🐉",
  spring: "🧧",
  womens: "🌸",
  childrens: "🧸",
  birthday: "🎂",
  tenure: "🎉",
  other: "🎁",
};

export default async function MyGiftsPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  const [activeEligibilities, history] = await Promise.all([
    prisma.eligibility.findMany({
      where: { employeeId: user.id, campaign: { status: "active" } },
      include: {
        campaign: {
          include: { campaignGifts: { include: { gift: true } } },
        },
      },
      orderBy: { campaign: { endAt: "asc" } },
    }),
    prisma.claim.findMany({
      where: { employeeId: user.id, status: "claimed" },
      include: { gift: true, campaign: true, warehouse: { include: { building: true } } },
      orderBy: { claimedAt: "desc" },
      take: 5,
    }),
  ]);

  // 每个活动取出已有的 claim
  const myClaims = await prisma.claim.findMany({
    where: { employeeId: user.id },
    include: { gift: true, warehouse: { include: { building: true } } },
  });
  const claimMap = new Map(myClaims.map((c) => [c.campaignId, c]));

  const pending = activeEligibilities.filter((e) => {
    const c = claimMap.get(e.campaignId);
    return !c || c.status === "cancelled";
  });
  const reserved = activeEligibilities.filter((e) => {
    const c = claimMap.get(e.campaignId);
    return c && c.status === "reserved";
  });
  const claimedThis = activeEligibilities.filter((e) => {
    const c = claimMap.get(e.campaignId);
    return c && c.status === "claimed";
  });

  return (
    <div className="px-4 py-5">
      {/* 欢迎语 */}
      <div className="mb-5">
        <div className="text-xl font-semibold">你好，{user.name.replace(/[（(].*$/, "")} 👋</div>
        <div className="text-sm text-muted-foreground mt-0.5">
          {pending.length > 0 ? (
            <>
              你有 <span className="text-primary font-medium">{pending.length}</span> 份福利可以领取
            </>
          ) : reserved.length > 0 ? (
            <>
              你有 <span className="text-warning font-medium">{reserved.length}</span> 份福利待核销
            </>
          ) : (
            "暂时没有可领的福利"
          )}
        </div>
      </div>

      {/* 待领取 */}
      {pending.length > 0 && (
        <Section title="待领取" icon={<Sparkles className="w-4 h-4 text-primary" />}>
          {pending.map((e) => {
            const c = e.campaign;
            return (
              <Link key={e.id} href={`/m/claim/${c.id}`}>
                <Card className="overflow-hidden hover:shadow-md hover:border-primary/40 transition-all">
                  <CardContent className="p-0">
                    <div className="p-4 bg-gradient-to-br from-rose-50 via-orange-50 to-amber-50 border-b">
                      <div className="flex items-start gap-3">
                        <div className="text-4xl">{HOLIDAY_EMOJI[c.holidayType] || "🎁"}</div>
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold">{c.name}</div>
                          <div className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{c.description}</div>
                        </div>
                      </div>
                    </div>
                    <div className="p-4 flex items-center justify-between">
                      <div className="text-xs">
                        <div className="text-muted-foreground">
                          {c.selectionMode === "choose_one"
                            ? `${c.campaignGifts.length} 选 1`
                            : "固定礼物"}
                        </div>
                        <div className="flex items-center gap-1 mt-1 text-amber-600">
                          <Clock className="w-3 h-3" /> 截止 {formatDate(c.endAt)}
                        </div>
                      </div>
                      <div className="inline-flex items-center gap-1 text-sm text-primary font-medium">
                        去领取 <ChevronRight className="w-4 h-4" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </Section>
      )}

      {/* 待核销 */}
      {reserved.length > 0 && (
        <Section title="待到店核销" icon={<Clock className="w-4 h-4 text-warning" />}>
          {reserved.map((e) => {
            const c = e.campaign;
            const claim = claimMap.get(c.id)!;
            return (
              <Link key={e.id} href={`/m/claim/${c.id}`}>
                <Card className="hover:shadow-md transition-all border-warning/30 bg-warning/5">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="text-3xl">{claim.gift.imageUrl || "🎁"}</div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium">{claim.gift.name}</div>
                        <div className="text-xs text-muted-foreground mt-0.5">
                          📍 {claim.warehouse.building.name}
                        </div>
                        <div className="font-mono text-sm text-warning mt-1.5">核销码 {claim.claimCode}</div>
                      </div>
                      <Badge variant="warning">待核销</Badge>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </Section>
      )}

      {/* 本期已领 */}
      {claimedThis.length > 0 && (
        <Section title="本期已领" icon={<CheckCircle2 className="w-4 h-4 text-success" />}>
          {claimedThis.map((e) => {
            const c = e.campaign;
            const claim = claimMap.get(c.id)!;
            return (
              <Card key={e.id}>
                <CardContent className="p-4 flex items-center gap-3">
                  <div className="text-3xl opacity-80">{claim.gift.imageUrl || "🎁"}</div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium">{claim.gift.name}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {formatDate(claim.claimedAt)} · {claim.warehouse.building.name}
                    </div>
                  </div>
                  <Badge variant="success">已领</Badge>
                </CardContent>
              </Card>
            );
          })}
        </Section>
      )}

      {/* 历史 */}
      {history.length > 0 && (
        <Section title="历史领取">
          {history.map((h) => (
            <div key={h.id} className="flex items-center gap-3 py-2.5">
              <div className="text-2xl opacity-70">{h.gift.imageUrl || "🎁"}</div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{h.gift.name}</div>
                <div className="text-xs text-muted-foreground">
                  {h.campaign.name} · {formatDate(h.claimedAt)}
                </div>
              </div>
            </div>
          ))}
        </Section>
      )}

      {pending.length === 0 && reserved.length === 0 && claimedThis.length === 0 && history.length === 0 && (
        <Empty
          icon={<GiftIcon className="w-12 h-12" />}
          title="还没有福利可领"
          desc="节日临近时会自动通知你"
          className="mt-8"
        />
      )}
    </div>
  );
}

function Section({ title, icon, children }: { title: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="mb-6">
      <div className="flex items-center gap-1.5 text-sm font-medium mb-2.5 text-muted-foreground">
        {icon}
        {title}
      </div>
      <div className="space-y-2.5">{children}</div>
    </div>
  );
}
