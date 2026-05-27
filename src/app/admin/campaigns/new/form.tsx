"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Check, ChevronLeft, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type Gift = { id: string; name: string; imageUrl: string | null; category: string };

const HOLIDAY_OPTIONS = [
  { value: "mid_autumn", label: "中秋", emoji: "🥮" },
  { value: "dragon_boat", label: "端午", emoji: "🎋" },
  { value: "spring", label: "春节", emoji: "🧧" },
  { value: "womens", label: "女神节", emoji: "🌸" },
  { value: "childrens", label: "儿童节", emoji: "🧸" },
  { value: "birthday", label: "生日", emoji: "🎂" },
  { value: "tenure", label: "司庆", emoji: "🎉" },
  { value: "new_hire", label: "新人入职", emoji: "🎁" },
  { value: "other", label: "其他", emoji: "🎀" },
];

// 农历节日 → 公历日期表（硬编码 2026-2028，每年农历转公历不同）
const LUNAR_HOLIDAY_DATES: Record<string, { y: number; m: number; d: number }[]> = {
  spring: [
    { y: 2026, m: 2, d: 17 },
    { y: 2027, m: 2, d: 6 },
    { y: 2028, m: 1, d: 26 },
  ],
  dragon_boat: [
    { y: 2026, m: 6, d: 19 },
    { y: 2027, m: 6, d: 9 },
    { y: 2028, m: 5, d: 28 },
  ],
  mid_autumn: [
    { y: 2026, m: 9, d: 25 },
    { y: 2027, m: 9, d: 15 },
    { y: 2028, m: 10, d: 3 },
  ],
};

// 固定公历节日 → (月, 日)
const FIXED_HOLIDAY_MD: Record<string, { m: number; d: number }> = {
  womens: { m: 3, d: 8 },
  childrens: { m: 6, d: 1 },
};

function pad(n: number) {
  return String(n).padStart(2, "0");
}
function toDatetimeLocal(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// 返回该节日下一次发生时间；找不到（不固定的、过去且无未来记录）返回 null
function nextHolidayDate(holidayType: string): Date | null {
  const now = Date.now();
  const lunar = LUNAR_HOLIDAY_DATES[holidayType];
  if (lunar) {
    const next = lunar.find((d) => new Date(d.y, d.m - 1, d.d).getTime() > now);
    return next ? new Date(next.y, next.m - 1, next.d) : null;
  }
  const fixed = FIXED_HOLIDAY_MD[holidayType];
  if (fixed) {
    const year = new Date().getFullYear();
    const thisYear = new Date(year, fixed.m - 1, fixed.d);
    return thisYear.getTime() > now ? thisYear : new Date(year + 1, fixed.m - 1, fixed.d);
  }
  return null; // birthday / tenure / new_hire / other — 不建议日期
}

// 节日 → 建议活动区间：节日前 7 天 09:00 开放，节日后 3 天 18:00 截止
function getSuggestedDateRange(holidayType: string): { startAt: string; endAt: string } | null {
  const target = nextHolidayDate(holidayType);
  if (!target) return null;
  const start = new Date(target.getTime() - 7 * 86400000);
  start.setHours(9, 0, 0, 0);
  const end = new Date(target.getTime() + 3 * 86400000);
  end.setHours(18, 0, 0, 0);
  return { startAt: toDatetimeLocal(start), endAt: toDatetimeLocal(end) };
}

type EligibilityPreset =
  | { kind: "all" }
  | { kind: "department"; departments: string[] }
  | { kind: "gender"; gender: "M" | "F" }
  | { kind: "building"; buildingIds: string[] }
  | { kind: "hasChildren" }
  | { kind: "tenure"; years: number }
  | { kind: "newHire"; days: number };

function presetToRule(p: EligibilityPreset) {
  switch (p.kind) {
    case "all":
      return { type: "ALL" };
    case "department":
      return p.departments.length === 1
        ? { type: "AND", rules: [{ field: "department", op: "=", value: p.departments[0] }] }
        : { type: "AND", rules: [{ field: "department", op: "in", value: p.departments }] };
    case "gender":
      return { type: "AND", rules: [{ field: "gender", op: "=", value: p.gender }] };
    case "building":
      return p.buildingIds.length === 1
        ? { type: "AND", rules: [{ field: "buildingId", op: "=", value: p.buildingIds[0] }] }
        : { type: "AND", rules: [{ field: "buildingId", op: "in", value: p.buildingIds }] };
    case "hasChildren":
      return { type: "AND", rules: [{ field: "hasChildren", op: "=", value: true }] };
    case "tenure":
      return { type: "AND", rules: [{ field: "tenureYears", op: ">=", value: p.years }] };
    case "newHire":
      return { type: "AND", rules: [{ field: "tenureDays", op: "<=", value: p.days }] };
  }
}

export function NewCampaignForm({
  gifts,
  departments,
  buildings,
}: {
  gifts: Gift[];
  departments: string[];
  buildings: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const [name, setName] = useState("");
  const [holidayType, setHolidayType] = useState("mid_autumn");
  const [description, setDescription] = useState("");
  const todayStr = new Date().toISOString().slice(0, 16);
  const in7DaysStr = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 16);
  const [startAt, setStartAt] = useState(todayStr);
  const [endAt, setEndAt] = useState(in7DaysStr);

  const [selectedGifts, setSelectedGifts] = useState<string[]>([]);
  const selectionMode = selectedGifts.length > 1 ? "choose_one" : "fixed";

  const [preset, setPreset] = useState<EligibilityPreset>({ kind: "all" });

  const rule = useMemo(() => presetToRule(preset), [preset]);

  const canSubmit =
    name.trim().length > 0 &&
    selectedGifts.length > 0 &&
    new Date(startAt) < new Date(endAt) &&
    // 新人预设的天数必须 > 0，否则资格名单永远是空
    (preset.kind !== "newHire" || preset.days > 0) &&
    (preset.kind !== "tenure" || preset.years >= 0);

  async function submit(status: "draft" | "active") {
    if (!canSubmit) return;
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          holidayType,
          description: description.trim(),
          startAt,
          endAt,
          selectionMode,
          eligibilityRule: rule,
          giftIds: selectedGifts,
          status,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "创建失败");
        setSubmitting(false);
        return;
      }
      router.push(`/admin/campaigns/${data.id}`);
    } catch (e) {
      setError("网络错误");
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-3xl">
      <Link
        href="/admin/campaigns"
        className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1 mb-3"
      >
        <ChevronLeft className="w-4 h-4" /> 返回活动列表
      </Link>
      <h1 className="text-2xl font-semibold">创建新活动</h1>
      <p className="text-sm text-muted-foreground mt-1">配置一次福利发放的基本信息、礼物和资格人群</p>

      <div className="space-y-6 mt-8">
        {/* 1. 基本信息 */}
        <Section step={1} title="基本信息">
          <div className="space-y-4">
            <div>
              <Label>活动名称 *</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="如：2026 中秋福利"
                className="mt-1.5"
              />
            </div>
            <div>
              <Label>节日类型</Label>
              <div className="grid grid-cols-4 gap-2 mt-1.5">
                {HOLIDAY_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => {
                      setHolidayType(opt.value);
                      // 选「新人入职」时自动联动资格预设：入职 30 天内
                      if (opt.value === "new_hire" && preset.kind !== "newHire") {
                        setPreset({ kind: "newHire", days: 30 });
                      }
                      // 从「新人入职」切到其他节日时，把新人预设重置成全员，避免 preset 卡在 newHire
                      if (opt.value !== "new_hire" && preset.kind === "newHire") {
                        setPreset({ kind: "all" });
                      }
                      // 固定/农历节日：自动套用建议日期区间（节日前 7 天 09:00 ~ 节日后 3 天 18:00）
                      const suggested = getSuggestedDateRange(opt.value);
                      if (suggested) {
                        setStartAt(suggested.startAt);
                        setEndAt(suggested.endAt);
                      }
                    }}
                    className={cn(
                      "h-12 rounded-lg border-2 text-sm transition-all flex items-center justify-center gap-1.5",
                      holidayType === opt.value
                        ? "border-primary bg-primary/5 text-primary font-medium"
                        : "border-input hover:border-primary/40"
                    )}
                  >
                    <span>{opt.emoji}</span>
                    {opt.label}
                  </button>
                ))}
              </div>
              {nextHolidayDate(holidayType) && (
                <div className="text-[11px] text-muted-foreground mt-1.5">
                  💡 已按节日日期（{(() => {
                    const d = nextHolidayDate(holidayType)!;
                    return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;
                  })()}）自动填好时间区间，可手动调整
                </div>
              )}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>开始时间 *</Label>
                <Input
                  type="datetime-local"
                  value={startAt}
                  onChange={(e) => setStartAt(e.target.value)}
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label>截止时间 *</Label>
                <Input
                  type="datetime-local"
                  value={endAt}
                  onChange={(e) => setEndAt(e.target.value)}
                  className="mt-1.5"
                />
              </div>
            </div>
            <div>
              <Label>简介（员工可见）</Label>
              <Input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="如：中秋快乐 🌕 三款月饼任选一份"
                className="mt-1.5"
              />
            </div>
          </div>
        </Section>

        {/* 2. 礼物 SKU */}
        <Section step={2} title="选择礼物" hint={selectedGifts.length > 1 ? "员工三选一" : "员工固定礼物"}>
          <div className="grid grid-cols-2 gap-2">
            {gifts.map((g) => {
              const selected = selectedGifts.includes(g.id);
              return (
                <button
                  key={g.id}
                  type="button"
                  onClick={() =>
                    setSelectedGifts((prev) =>
                      prev.includes(g.id) ? prev.filter((id) => id !== g.id) : [...prev, g.id]
                    )
                  }
                  className={cn(
                    "flex items-center gap-3 p-3 rounded-lg border-2 text-left transition-all",
                    selected ? "border-primary bg-primary/5" : "border-input hover:border-primary/40"
                  )}
                >
                  <div className="text-2xl">{g.imageUrl || "🎁"}</div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm truncate">{g.name}</div>
                    <div className="text-xs text-muted-foreground">{g.category}</div>
                  </div>
                  {selected && <Check className="w-5 h-5 text-primary shrink-0" />}
                </button>
              );
            })}
          </div>
        </Section>

        {/* 3. 资格人群 */}
        <Section step={3} title="资格人群" hint="谁能领这份礼物">
          <div className="grid grid-cols-2 gap-2 mb-3">
            <PresetButton active={preset.kind === "all"} onClick={() => setPreset({ kind: "all" })}>
              👥 全员
            </PresetButton>
            <PresetButton
              active={preset.kind === "gender" && (preset as any).gender === "F"}
              onClick={() => setPreset({ kind: "gender", gender: "F" })}
            >
              🌸 仅女员工
            </PresetButton>
            <PresetButton
              active={preset.kind === "hasChildren"}
              onClick={() => setPreset({ kind: "hasChildren" })}
            >
              👶 仅有娃员工
            </PresetButton>
            <PresetButton
              active={preset.kind === "tenure"}
              onClick={() => setPreset({ kind: "tenure", years: 1 })}
            >
              🎖️ 司龄 ≥ N 年
            </PresetButton>
            <PresetButton
              active={preset.kind === "department"}
              onClick={() => setPreset({ kind: "department", departments: [] })}
            >
              🧩 指定部门
            </PresetButton>
            <PresetButton
              active={preset.kind === "building"}
              onClick={() => setPreset({ kind: "building", buildingIds: [] })}
            >
              🏢 指定楼宇
            </PresetButton>
            <PresetButton
              active={preset.kind === "newHire"}
              onClick={() => setPreset({ kind: "newHire", days: 30 })}
            >
              🎁 新人（入职 N 天内）
            </PresetButton>
          </div>

          {preset.kind === "tenure" && (
            <div className="rounded-lg border bg-muted/30 p-3 flex items-center gap-2">
              <span className="text-sm">司龄 ≥</span>
              <Input
                type="number"
                min={0}
                value={preset.years}
                onChange={(e) => setPreset({ kind: "tenure", years: Number(e.target.value) || 0 })}
                className="w-20 h-8"
              />
              <span className="text-sm">年</span>
            </div>
          )}

          {preset.kind === "newHire" && (
            <div className="rounded-lg border bg-muted/30 p-3 flex items-center gap-2 flex-wrap">
              <span className="text-sm">入职 ≤</span>
              <Input
                type="number"
                min={1}
                value={preset.days}
                onChange={(e) => setPreset({ kind: "newHire", days: Number(e.target.value) || 0 })}
                className="w-20 h-8"
              />
              <span className="text-sm">天</span>
              <div className="flex gap-1 ml-2">
                {[7, 30, 60, 90].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setPreset({ kind: "newHire", days: n })}
                    className={cn(
                      "px-2 py-0.5 rounded-md text-xs border transition-all",
                      preset.days === n
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-background hover:border-primary/40"
                    )}
                  >
                    {n} 天
                  </button>
                ))}
              </div>
              <div className="w-full text-xs text-muted-foreground mt-1">
                💡 新人欢迎礼盒常用 30 天，试用期通常 90 天
              </div>
            </div>
          )}

          {preset.kind === "department" && (
            <div className="rounded-lg border bg-muted/30 p-3 flex flex-wrap gap-2">
              {departments.map((d) => {
                const selected = (preset as any).departments.includes(d);
                return (
                  <button
                    key={d}
                    type="button"
                    onClick={() => {
                      const cur = (preset as any).departments as string[];
                      setPreset({
                        kind: "department",
                        departments: selected ? cur.filter((x) => x !== d) : [...cur, d],
                      });
                    }}
                    className={cn(
                      "px-3 py-1 rounded-full text-xs border transition-all",
                      selected ? "bg-primary text-primary-foreground border-primary" : "bg-background hover:border-primary/40"
                    )}
                  >
                    {d}
                  </button>
                );
              })}
            </div>
          )}

          {preset.kind === "building" && (
            <div className="rounded-lg border bg-muted/30 p-3 flex flex-wrap gap-2">
              {buildings.map((b) => {
                const selected = (preset as any).buildingIds.includes(b.id);
                return (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => {
                      const cur = (preset as any).buildingIds as string[];
                      setPreset({
                        kind: "building",
                        buildingIds: selected ? cur.filter((x) => x !== b.id) : [...cur, b.id],
                      });
                    }}
                    className={cn(
                      "px-3 py-1 rounded-full text-xs border transition-all",
                      selected ? "bg-primary text-primary-foreground border-primary" : "bg-background hover:border-primary/40"
                    )}
                  >
                    {b.name}
                  </button>
                );
              })}
            </div>
          )}
        </Section>

        {error && (
          <div className="text-sm text-destructive bg-destructive/10 rounded-md px-4 py-2.5">{error}</div>
        )}

        <div className="flex items-center gap-3 sticky bottom-4">
          <Button variant="outline" onClick={() => submit("draft")} disabled={!canSubmit || submitting}>
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            保存草稿
          </Button>
          <Button onClick={() => submit("active")} disabled={!canSubmit || submitting}>
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            立即发布
          </Button>
          {!canSubmit && (
            <div className="text-xs text-muted-foreground">
              {!name.trim()
                ? "请填写活动名称"
                : selectedGifts.length === 0
                ? "至少选 1 个礼物"
                : new Date(startAt) >= new Date(endAt)
                ? "时间区间无效"
                : preset.kind === "newHire" && preset.days <= 0
                ? "新人入职天数必须大于 0"
                : ""}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Section({ step, title, hint, children }: { step: number; title: string; hint?: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-7 h-7 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm font-semibold">
            {step}
          </div>
          <div className="font-semibold">{title}</div>
          {hint && <Badge variant="muted">{hint}</Badge>}
        </div>
        {children}
      </CardContent>
    </Card>
  );
}

function PresetButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "h-11 rounded-lg border-2 text-sm transition-all",
        active ? "border-primary bg-primary/5 text-primary font-medium" : "border-input hover:border-primary/40"
      )}
    >
      {children}
    </button>
  );
}
