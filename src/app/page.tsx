import Link from "next/link";
import { redirect } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { Gift, ShieldCheck, ScanLine, ArrowRight, Building2, Monitor, Smartphone } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const user = await getCurrentUser();

  // 如果已登录，直接根据角色跳转
  if (user) {
    if (user.role === "admin") redirect("/admin");
    if (user.role === "verifier") redirect("/verify");
    redirect("/m");
  }

  // 拉一下实际的核销员/楼宇分布，确保 demo 数据真实
  const verifiers = await prisma.employee.findMany({
    where: { role: "verifier" },
    include: { building: true },
    orderBy: { employeeNo: "asc" },
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50">
      <div className="container max-w-6xl py-12 md:py-20">
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium mb-6">
            <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
            vibecoding MVP · v0.2
          </div>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">
            礼达 · 节日福利发放系统
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            为 3000 人规模的多楼宇公司提供节日礼物发放×员工自助领取×行政高效管理的一体化系统
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {/* 行政管理 */}
          <RoleCard
            title="行政管理端"
            desc="活动 / 库存 / 看板 / 补录 / 名单导入 / 用户与权限"
            icon={ShieldCheck}
            color="from-blue-500 to-indigo-500"
            device="desktop"
            accounts={[{ no: "10001", label: "管理员小 A", sub: "行政人事" }]}
            note="可在员工管理页改任何人的角色与楼宇"
          />

          {/* 员工领取 */}
          <RoleCard
            title="员工领取端"
            desc="查看可领礼物 / 一键预约 / 出示核销码"
            icon={Gift}
            color="from-rose-500 to-orange-500"
            device="mobile"
            accounts={[
              { no: "30001", label: "员工小 B", sub: "男 · 研发中心" },
              { no: "30002", label: "员工小 D", sub: "女 · 设计中心 · 有娃" },
              { no: "30003", label: "员工小 E", sub: "女 · 产品中心" },
            ]}
            note="不同员工的资格不同（女员工才能领女神节）"
          />

          {/* 分仓核销 —— 三个楼宇分别一个 */}
          <RoleCard
            title="分仓核销端"
            desc="扫码核销 / 工号核销 / 实时库存 · 仅能核销本楼宇预约"
            icon={ScanLine}
            color="from-emerald-500 to-teal-500"
            device="mobile"
            accounts={verifiers.map((v) => ({
              no: v.employeeNo,
              label: v.name.replace(/[（(].*$/, "").trim(),
              sub: v.building?.name || "未分配",
            }))}
            note="不同楼宇之间的核销码会互相拒绝"
          />
        </div>

        <div className="mt-12 text-center">
          <Button asChild variant="ghost">
            <Link href="/login">使用其他工号登录 →</Link>
          </Button>
        </div>

        <div className="mt-16 text-center text-xs text-muted-foreground">
          MVP 覆盖 PRD §7 Must · 单层 AND/OR 规则引擎 · 软锁定库存 · 一码一用 · 自动过期 · Excel 导入 · 补录领取
        </div>
      </div>
    </div>
  );
}

function RoleCard({
  title,
  desc,
  icon: Icon,
  color,
  device,
  accounts,
  note,
}: {
  title: string;
  desc: string;
  icon: any;
  color: string;
  device?: "mobile" | "desktop";
  accounts: { no: string; label: string; sub?: string }[];
  note?: string;
}) {
  const deviceMeta =
    device === "mobile"
      ? {
          label: "建议手机端打开",
          icon: Smartphone,
          className: "text-rose-700 bg-rose-50 border-rose-200",
        }
      : device === "desktop"
      ? {
          label: "建议电脑端操作",
          icon: Monitor,
          className: "text-blue-700 bg-blue-50 border-blue-200",
        }
      : null;
  const DeviceIcon = deviceMeta?.icon;
  return (
    <Card className="group hover:shadow-lg transition-all overflow-hidden border-2 hover:border-primary/40">
      <CardContent className="p-6 space-y-4">
        <div className="flex items-start justify-between gap-2">
          <div
            className={`w-12 h-12 rounded-xl bg-gradient-to-br ${color} flex items-center justify-center text-white shadow-sm shrink-0`}
          >
            <Icon className="w-6 h-6" />
          </div>
          {deviceMeta && DeviceIcon && (
            <span
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium border ${deviceMeta.className}`}
            >
              <DeviceIcon className="w-3 h-3" />
              {deviceMeta.label}
            </span>
          )}
        </div>
        <div>
          <div className="text-lg font-semibold">{title}</div>
          <div className="text-sm text-muted-foreground mt-1">{desc}</div>
        </div>

        <div className="space-y-1.5">
          {accounts.map((a, i) => (
            <Link
              key={a.no}
              href={`/login?no=${a.no}`}
              className="flex items-center gap-2.5 rounded-lg border bg-card hover:bg-primary/5 hover:border-primary/40 px-3 py-2 transition-all"
            >
              <span className="font-mono text-sm font-semibold tabular-nums">{a.no}</span>
              <div className="flex-1 min-w-0">
                <div className="text-xs leading-tight truncate">{a.label}</div>
                {a.sub && (
                  <div className="text-[10px] text-muted-foreground leading-tight truncate flex items-center gap-1 mt-0.5">
                    {a.sub.includes("座") || a.sub.includes("楼") ? <Building2 className="w-2.5 h-2.5" /> : null}
                    {a.sub}
                  </div>
                )}
              </div>
              <ArrowRight className="w-3.5 h-3.5 text-muted-foreground" />
            </Link>
          ))}
        </div>

        {note && (
          <div className="text-[11px] text-muted-foreground bg-muted/40 rounded-md px-2.5 py-1.5">
            💡 {note}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
