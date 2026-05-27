"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Loader2, AlertTriangle, Plus, Pencil, Trash2, Package } from "lucide-react";

type Warehouse = { id: string; buildingName: string };
type Gift = {
  id: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  value: number; // 分
  category: string;
  allergenTags: string[];
};

const CATEGORIES = [
  { value: "food", label: "食品", emoji: "🍱", hint: "需填过敏原" },
  { value: "daily", label: "日用", emoji: "🧴", hint: "" },
  { value: "digital", label: "数码", emoji: "📱", hint: "" },
  { value: "other", label: "其他", emoji: "🎁", hint: "" },
];

// 图标候选：按品类分组建议，点击直接填入
const ICON_SUGGESTIONS: Record<string, string[]> = {
  food: ["🥮", "🎋", "🧧", "🍱", "🥟", "🍡", "🍵", "🧃", "🍰", "🍫", "🍪", "🍎"],
  daily: ["🎁", "🍵", "🧴", "🌸", "🧩", "🧸", "📒", "🖌️", "🎒", "🧦", "🛁", "🪴"],
  digital: ["📱", "💻", "⌚", "🎧", "🖱️", "⌨️", "🔋", "📷", "🎮", "💾", "🖥️", "📡"],
  other: ["🎁", "🎀", "🏆", "🎈", "🎊", "🎉", "💐", "✨", "🌟", "🎂", "🍾", "📦"],
};

const COMMON_ALLERGENS = ["nuts", "dairy", "egg", "gluten", "soy", "seafood"];
const ALLERGEN_LABEL: Record<string, string> = {
  nuts: "坚果",
  dairy: "奶制品",
  egg: "蛋",
  gluten: "麸质",
  soy: "大豆",
  seafood: "海鲜",
};

export function NewGiftButton({ warehouses }: { warehouses: Warehouse[] }) {
  return <GiftDialog mode="create" warehouses={warehouses} />;
}

export function EditGiftButton({ gift, warehouses }: { gift: Gift; warehouses: Warehouse[] }) {
  return <GiftDialog mode="edit" gift={gift} warehouses={warehouses} />;
}

function GiftDialog({
  mode,
  gift,
  warehouses,
}: {
  mode: "create" | "edit";
  gift?: Gift;
  warehouses: Warehouse[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [deleteHint, setDeleteHint] = useState("");

  const [form, setForm] = useState({
    name: gift?.name ?? "",
    description: gift?.description ?? "",
    // 创建模式默认 🎁 占位；编辑模式保留 DB 真实值（null 时为空，不强行写入）
    imageUrl: gift ? gift.imageUrl ?? "" : "🎁",
    valueYuan: gift ? String(gift.value / 100) : "",
    category: gift?.category ?? "other",
    allergenTags: gift?.allergenTags ?? [],
  });

  // 各分仓初始库存（仅创建模式用）
  const [initialInv, setInitialInv] = useState<Record<string, number>>(
    Object.fromEntries(warehouses.map((w) => [w.id, 0]))
  );

  useEffect(() => {
    if (open) {
      setForm({
        name: gift?.name ?? "",
        description: gift?.description ?? "",
        imageUrl: gift ? gift.imageUrl ?? "" : "🎁",
        valueYuan: gift ? String(gift.value / 100) : "",
        category: gift?.category ?? "other",
        allergenTags: gift?.allergenTags ?? [],
      });
      setInitialInv(Object.fromEntries(warehouses.map((w) => [w.id, 0])));
      setError("");
      setDeleteHint("");
    }
  }, [open, gift, warehouses]);

  const needsAllergens = form.category === "food";

  async function submit() {
    setSubmitting(true);
    setError("");
    const valueFen = Math.round(Number(form.valueYuan) * 100);
    if (!form.name.trim()) {
      setError("礼物名称必填");
      setSubmitting(false);
      return;
    }
    if (!Number.isFinite(valueFen) || valueFen < 0) {
      setError("估值必须是非负数字");
      setSubmitting(false);
      return;
    }

    const url = mode === "create" ? "/api/gifts" : `/api/gifts/${gift!.id}`;
    const method = mode === "create" ? "POST" : "PATCH";
    const payload: any = {
      name: form.name,
      description: form.description,
      imageUrl: form.imageUrl,
      value: valueFen,
      category: form.category,
      allergenTags: form.allergenTags,
    };
    if (mode === "create") {
      payload.initialInventory = warehouses
        .map((w) => ({ warehouseId: w.id, qtyTotal: initialInv[w.id] || 0 }))
        .filter((i) => i.qtyTotal > 0);
    }

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "保存失败");
      setSubmitting(false);
      return;
    }
    router.refresh();
    setOpen(false);
    setSubmitting(false);
  }

  async function doDelete() {
    if (!gift) return;
    if (!confirm(`确认删除「${gift.name}」？此操作不可撤销。\n（有依赖会被阻止）`)) return;
    setSubmitting(true);
    setError("");
    setDeleteHint("");
    const res = await fetch(`/api/gifts/${gift.id}`, { method: "DELETE" });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "删除失败");
      if (data.hint) setDeleteHint(data.hint);
      setSubmitting(false);
      return;
    }
    router.refresh();
    setOpen(false);
    setSubmitting(false);
  }

  const totalInitialInv = Object.values(initialInv).reduce((a, b) => a + (b || 0), 0);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {mode === "create" ? (
          <Button>
            <Plus className="w-4 h-4" />
            新增礼物
          </Button>
        ) : (
          <Button size="sm" variant="ghost" className="h-7 px-2">
            <Pencil className="w-3.5 h-3.5" />
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {mode === "create" ? "新增礼物 SKU" : `编辑 ${gift?.name}`}
          </DialogTitle>
          <DialogDescription>
            {mode === "create"
              ? "录入商品信息 + 初始库存。创建后挂到活动里员工就能领"
              : "调整商品信息。库存请去「库存管理」页改"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* 商品信息 */}
          <div className="grid grid-cols-12 gap-3">
            <div className="col-span-2">
              <Label>图标</Label>
              <Input
                value={form.imageUrl}
                onChange={(e) => setForm({ ...form, imageUrl: e.target.value })}
                placeholder="🎁"
                maxLength={2}
                className="mt-1.5 text-center text-xl"
              />
            </div>
            <div className="col-span-12 -mt-2">
              <div className="text-[11px] text-muted-foreground mb-1.5">
                建议图标（按当前品类 · 点选直接套用）
              </div>
              <div className="flex flex-wrap gap-1">
                {(ICON_SUGGESTIONS[form.category] || ICON_SUGGESTIONS.other).map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => setForm({ ...form, imageUrl: emoji })}
                    className={cn(
                      "w-9 h-9 rounded-md border text-lg transition-all hover:bg-muted",
                      form.imageUrl === emoji
                        ? "border-primary bg-primary/5"
                        : "border-input"
                    )}
                    aria-label={`使用 ${emoji}`}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>
            <div className="col-span-7">
              <Label>名称 *</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="如 新人入职礼盒"
                className="mt-1.5"
              />
            </div>
            <div className="col-span-3">
              <Label>估值（元） *</Label>
              <Input
                type="number"
                min={0}
                step={0.01}
                value={form.valueYuan}
                onChange={(e) => setForm({ ...form, valueYuan: e.target.value })}
                placeholder="168"
                className="mt-1.5"
              />
            </div>
            <div className="col-span-12">
              <Label>描述</Label>
              <Input
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="如 公司周边大礼包：保温杯 + 笔记本 + tote bag"
                className="mt-1.5"
              />
            </div>
            <div className="col-span-12">
              <Label>品类</Label>
              <div className="grid grid-cols-4 gap-2 mt-1.5">
                {CATEGORIES.map((c) => (
                  <button
                    key={c.value}
                    type="button"
                    onClick={() => setForm({ ...form, category: c.value })}
                    className={cn(
                      "h-12 rounded-lg border-2 text-sm transition-all flex items-center justify-center gap-1.5",
                      form.category === c.value
                        ? "border-primary bg-primary/5 text-primary font-medium"
                        : "border-input hover:border-primary/40"
                    )}
                  >
                    <span>{c.emoji}</span>
                    {c.label}
                  </button>
                ))}
              </div>
              {needsAllergens && (
                <div className="text-xs text-amber-600 mt-2">⚠️ 食品类必须标过敏原（员工筛选用）</div>
              )}
            </div>
            {needsAllergens && (
              <div className="col-span-12">
                <Label>过敏原标签</Label>
                <div className="flex flex-wrap gap-2 mt-1.5">
                  {COMMON_ALLERGENS.map((a) => {
                    const selected = form.allergenTags.includes(a);
                    return (
                      <button
                        key={a}
                        type="button"
                        onClick={() =>
                          setForm({
                            ...form,
                            allergenTags: selected
                              ? form.allergenTags.filter((x) => x !== a)
                              : [...form.allergenTags, a],
                          })
                        }
                        className={cn(
                          "px-3 py-1 rounded-full text-xs border transition-all",
                          selected
                            ? "bg-amber-100 text-amber-700 border-amber-300"
                            : "bg-background hover:border-primary/40"
                        )}
                      >
                        {ALLERGEN_LABEL[a]}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* 初始库存：仅创建模式 */}
          {mode === "create" && warehouses.length > 0 && (
            <div className="pt-3 border-t">
              <div className="flex items-center justify-between mb-2">
                <Label className="text-base">初始库存（按分仓填）</Label>
                <Badge variant={totalInitialInv > 0 ? "success" : "muted"}>
                  共 {totalInitialInv} 件
                </Badge>
              </div>
              <div className="text-xs text-muted-foreground mb-3">
                建议至少有一个分仓 &gt; 0，否则挂活动后员工预约会撞「无库存」
              </div>
              <div className="grid grid-cols-1 gap-2">
                {warehouses.map((w) => (
                  <div key={w.id} className="flex items-center gap-3 rounded-lg border p-2.5">
                    <Package className="w-4 h-4 text-muted-foreground" />
                    <div className="flex-1 text-sm">{w.buildingName}</div>
                    <Input
                      type="number"
                      min={0}
                      value={initialInv[w.id] || 0}
                      onChange={(e) =>
                        setInitialInv({ ...initialInv, [w.id]: Math.max(0, Number(e.target.value) || 0) })
                      }
                      className="w-24 h-8 text-center"
                    />
                    <span className="text-xs text-muted-foreground w-6">件</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {error && (
            <div className="rounded-lg bg-destructive/10 text-destructive px-3 py-2.5 text-sm flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
              <div>
                {error}
                {deleteHint && <div className="text-xs mt-1 opacity-80">{deleteHint}</div>}
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          {mode === "edit" && (
            <Button
              variant="ghost"
              size="sm"
              onClick={doDelete}
              disabled={submitting}
              className="text-destructive hover:text-destructive mr-auto"
            >
              <Trash2 className="w-4 h-4" />
              删除
            </Button>
          )}
          <Button variant="outline" onClick={() => setOpen(false)} disabled={submitting}>
            取消
          </Button>
          <Button onClick={submit} disabled={submitting}>
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            保存
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
