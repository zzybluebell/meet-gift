"use client";

import { useState } from "react";
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
import { Plus, Loader2, CheckCircle2, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

type Gift = { id: string; name: string; emoji: string };
type Warehouse = { id: string; name: string };

export function ManualClaimDialog({
  campaignId,
  gifts,
  warehouses,
  multiSelect,
}: {
  campaignId: string;
  gifts: Gift[];
  warehouses: Warehouse[];
  multiSelect: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [employeeNo, setEmployeeNo] = useState("");
  const [giftId, setGiftId] = useState(multiSelect ? "" : gifts[0]?.id || "");
  const [warehouseId, setWarehouseId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null);

  const canSubmit = employeeNo.trim() && (multiSelect ? !!giftId : true);

  async function submit() {
    if (!canSubmit) return;
    setSubmitting(true);
    setResult(null);
    const res = await fetch(`/api/campaigns/${campaignId}/manual-claim`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        employeeNo: employeeNo.trim(),
        giftId: multiSelect ? giftId : undefined,
        warehouseId: warehouseId || undefined,
      }),
    });
    const data = await res.json();
    if (res.ok) {
      setResult({ ok: true, msg: `已为 ${data.employee.name}（${data.employee.no}）补录成功` });
      router.refresh();
    } else {
      setResult({ ok: false, msg: data.error || "补录失败" });
    }
    setSubmitting(false);
  }

  function reset() {
    setEmployeeNo("");
    setGiftId(multiSelect ? "" : gifts[0]?.id || "");
    setWarehouseId("");
    setResult(null);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Plus className="w-4 h-4" />
          补录领取
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>补录领取</DialogTitle>
          <DialogDescription>
            为员工手动补登一笔已领取记录（用于代领、补发、漏发等场景）
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label>员工工号 *</Label>
            <Input
              value={employeeNo}
              onChange={(e) => setEmployeeNo(e.target.value)}
              placeholder="如 30001"
              autoFocus
              className="mt-1.5 font-mono"
            />
          </div>

          {multiSelect && (
            <div>
              <Label>礼物 *</Label>
              <div className="grid grid-cols-1 gap-2 mt-1.5">
                {gifts.map((g) => (
                  <button
                    key={g.id}
                    type="button"
                    onClick={() => setGiftId(g.id)}
                    className={cn(
                      "p-2 rounded-lg border-2 text-left text-sm transition-all flex items-center gap-2",
                      giftId === g.id ? "border-primary bg-primary/5" : "border-input hover:border-primary/40"
                    )}
                  >
                    <span className="text-xl">{g.emoji}</span>
                    {g.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div>
            <Label>领取楼宇</Label>
            <div className="grid grid-cols-1 gap-2 mt-1.5">
              <button
                type="button"
                onClick={() => setWarehouseId("")}
                className={cn(
                  "p-2 rounded-lg border-2 text-left text-sm transition-all",
                  warehouseId === "" ? "border-primary bg-primary/5" : "border-input hover:border-primary/40"
                )}
              >
                自动：员工所在楼宇
              </button>
              {warehouses.map((w) => (
                <button
                  key={w.id}
                  type="button"
                  onClick={() => setWarehouseId(w.id)}
                  className={cn(
                    "p-2 rounded-lg border-2 text-left text-sm transition-all",
                    warehouseId === w.id ? "border-primary bg-primary/5" : "border-input hover:border-primary/40"
                  )}
                >
                  {w.name}
                </button>
              ))}
            </div>
          </div>

          {result && (
            <div
              className={cn(
                "rounded-lg p-3 flex items-start gap-2 text-sm",
                result.ok ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"
              )}
            >
              {result.ok ? (
                <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
              ) : (
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              )}
              {result.msg}
            </div>
          )}
        </div>

        <DialogFooter>
          {!result?.ok ? (
            <>
              <Button variant="outline" onClick={() => setOpen(false)} disabled={submitting}>
                取消
              </Button>
              <Button onClick={submit} disabled={!canSubmit || submitting}>
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                确认补录
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={reset}>
                继续补录
              </Button>
              <Button onClick={() => setOpen(false)}>完成</Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
