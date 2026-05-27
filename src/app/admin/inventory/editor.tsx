"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export function InventoryEditor({
  giftId,
  warehouseId,
  qtyTotal,
  qtyReserved,
  qtyClaimed,
}: {
  giftId: string;
  warehouseId: string;
  qtyTotal: number;
  qtyReserved: number;
  qtyClaimed: number;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [v, setV] = useState(qtyTotal);
  const [busy, setBusy] = useState(false);
  const available = qtyTotal - qtyReserved - qtyClaimed;
  const isLow = available <= 5 && qtyTotal > 0;
  const isEmpty = qtyTotal === 0;

  async function save() {
    if (v === qtyTotal) {
      setEditing(false);
      return;
    }
    if (v < qtyReserved + qtyClaimed) {
      alert(`总量不能小于已锁定 + 已发放 (${qtyReserved + qtyClaimed})`);
      setV(qtyTotal);
      setEditing(false);
      return;
    }
    setBusy(true);
    const res = await fetch("/api/inventory", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ giftId, warehouseId, qtyTotal: v }),
    });
    if (!res.ok) {
      const data = await res.json();
      alert(data.error || "保存失败");
      setV(qtyTotal);
    } else {
      router.refresh();
    }
    setBusy(false);
    setEditing(false);
  }

  return editing ? (
    <Input
      type="number"
      min={qtyReserved + qtyClaimed}
      value={v}
      autoFocus
      onChange={(e) => setV(Number(e.target.value) || 0)}
      onBlur={save}
      onKeyDown={(e) => {
        if (e.key === "Enter") save();
        if (e.key === "Escape") {
          setV(qtyTotal);
          setEditing(false);
        }
      }}
      disabled={busy}
      className="h-8 text-center w-20 mx-auto"
    />
  ) : (
    <button
      onClick={() => setEditing(true)}
      className={cn(
        "w-full px-2 py-1.5 rounded-md hover:bg-muted/60 transition-colors text-center group",
        isEmpty && "opacity-50"
      )}
    >
      <div
        className={cn(
          "font-semibold tabular-nums",
          isLow && "text-amber-600",
          isEmpty && "text-muted-foreground"
        )}
      >
        {available}
      </div>
      <div className="text-[10px] text-muted-foreground mt-0.5">
        总{qtyTotal} 预{qtyReserved} 发{qtyClaimed}
      </div>
    </button>
  );
}
