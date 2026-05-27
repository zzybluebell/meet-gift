"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import QRCode from "qrcode";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, MapPin, AlertTriangle, Loader2, RotateCcw } from "lucide-react";
import { cn, formatDate } from "@/lib/utils";

type Gift = {
  id: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  allergenTags: string;
};

type Warehouse = {
  id: string;
  name: string;
  inventoryByGift: Record<string, number>;
};

type ExistingClaim = {
  id: string;
  status: string;
  claimCode: string;
  qrToken: string;
  giftId: string;
  giftName: string;
  giftImageUrl: string | null;
  warehouseId: string;
  warehouseName: string;
};

export function ClaimFlow({
  campaign,
  warehouses,
  defaultWarehouseId,
  existingClaim,
}: {
  campaign: {
    id: string;
    selectionMode: string;
    endAt: string;
    gifts: Gift[];
  };
  warehouses: Warehouse[];
  defaultWarehouseId: string | null;
  existingClaim: ExistingClaim | null;
}) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const [selectedGift, setSelectedGift] = useState<string>(
    existingClaim?.giftId ||
      (campaign.gifts.length === 1 ? campaign.gifts[0].id : "")
  );
  const [selectedWarehouse, setSelectedWarehouse] = useState<string>(
    existingClaim?.warehouseId || defaultWarehouseId || warehouses[0]?.id || ""
  );

  // 已有 claim：直接显示核销码
  if (existingClaim && existingClaim.status !== "cancelled") {
    return <ClaimResult claim={existingClaim} endAt={campaign.endAt} onCancel={async () => {
      if (!confirm("确定取消预约？预约取消后需重新预约")) return;
      setSubmitting(true);
      const res = await fetch(`/api/claims/${existingClaim.id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json();
        alert(data.error || "取消失败");
        setSubmitting(false);
        return;
      }
      router.refresh();
    }} cancelling={submitting} />;
  }

  // 预约流程
  const giftInventory = selectedGift
    ? warehouses.find((w) => w.id === selectedWarehouse)?.inventoryByGift[selectedGift] ?? 0
    : 0;

  const canSubmit = selectedGift && selectedWarehouse && giftInventory > 0 && !submitting;

  async function submit() {
    if (!canSubmit) return;
    setSubmitting(true);
    setError("");
    const res = await fetch("/api/claims", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        campaignId: campaign.id,
        giftId: selectedGift,
        warehouseId: selectedWarehouse,
      }),
    });
    if (!res.ok) {
      const data = await res.json();
      setError(data.error || "预约失败");
      setSubmitting(false);
      return;
    }
    router.refresh();
  }

  return (
    <div className="space-y-5 mt-4">
      {/* 选礼物 */}
      <div>
        <div className="text-sm font-medium mb-2">
          {campaign.selectionMode === "choose_one" ? "选择你想要的礼物" : "本次礼物"}
        </div>
        <div className="space-y-2">
          {campaign.gifts.map((g) => {
            const selected = selectedGift === g.id;
            const allergens: string[] = JSON.parse(g.allergenTags || "[]");
            const totalStock = warehouses.reduce(
              (acc, w) => acc + (w.inventoryByGift[g.id] || 0),
              0
            );
            return (
              <button
                key={g.id}
                type="button"
                disabled={campaign.selectionMode === "fixed"}
                onClick={() => setSelectedGift(g.id)}
                className={cn(
                  "w-full rounded-xl border-2 p-3 text-left transition-all",
                  selected ? "border-primary bg-primary/5" : "border-input",
                  campaign.selectionMode === "choose_one" && !selected && "hover:border-primary/40"
                )}
              >
                <div className="flex items-start gap-3">
                  <div className="text-4xl">{g.imageUrl || "🎁"}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <div className="font-medium">{g.name}</div>
                      {selected && <Check className="w-4 h-4 text-primary" />}
                    </div>
                    {g.description && (
                      <div className="text-xs text-muted-foreground mt-1 line-clamp-2">{g.description}</div>
                    )}
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {allergens.length > 0 && (
                        <Badge variant="warning" className="text-[10px]">
                          含 {allergens.join("、")}
                        </Badge>
                      )}
                      <Badge variant="muted" className="text-[10px]">
                        全公司余 {totalStock}
                      </Badge>
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* 选楼宇 */}
      <div>
        <div className="text-sm font-medium mb-2">
          选择领取楼宇 <span className="text-xs text-muted-foreground font-normal">(就近原则)</span>
        </div>
        <div className="grid grid-cols-1 gap-2">
          {warehouses.map((w) => {
            const stock = selectedGift ? w.inventoryByGift[selectedGift] || 0 : null;
            const outOfStock = stock !== null && stock <= 0;
            const selected = selectedWarehouse === w.id;
            return (
              <button
                key={w.id}
                type="button"
                disabled={outOfStock}
                onClick={() => setSelectedWarehouse(w.id)}
                className={cn(
                  "w-full rounded-xl border-2 p-3 text-left transition-all flex items-center gap-3",
                  outOfStock && "opacity-50 cursor-not-allowed",
                  selected && !outOfStock ? "border-primary bg-primary/5" : "border-input"
                )}
              >
                <MapPin className={cn("w-4 h-4", selected ? "text-primary" : "text-muted-foreground")} />
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm">{w.name}</div>
                  {stock !== null && (
                    <div
                      className={cn(
                        "text-xs mt-0.5",
                        outOfStock ? "text-destructive" : stock <= 5 ? "text-warning" : "text-muted-foreground"
                      )}
                    >
                      {outOfStock ? "已缺货" : `余 ${stock} 份`}
                    </div>
                  )}
                </div>
                {selected && !outOfStock && <Check className="w-4 h-4 text-primary" />}
              </button>
            );
          })}
        </div>
      </div>

      {error && (
        <div className="rounded-lg bg-destructive/10 text-destructive px-3 py-2.5 text-sm flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
          {error}
        </div>
      )}

      <Button onClick={submit} disabled={!canSubmit} className="w-full" size="lg">
        {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
        立即预约领取
      </Button>

      <div className="text-xs text-muted-foreground text-center">
        预约后请于 <span className="text-foreground font-medium">{formatDate(campaign.endAt)}</span> 前到选定楼宇核销
      </div>
    </div>
  );
}

function ClaimResult({
  claim,
  endAt,
  onCancel,
  cancelling,
}: {
  claim: ExistingClaim;
  endAt: string;
  onCancel: () => void;
  cancelling: boolean;
}) {
  const [qrDataUrl, setQrDataUrl] = useState("");

  useEffect(() => {
    const payload = JSON.stringify({ qrToken: claim.qrToken, code: claim.claimCode });
    QRCode.toDataURL(payload, { width: 320, margin: 1, color: { dark: "#0f172a", light: "#ffffff" } })
      .then(setQrDataUrl)
      .catch(console.error);
  }, [claim.qrToken, claim.claimCode]);

  const isClaimed = claim.status === "claimed";

  return (
    <div className="mt-4 space-y-4">
      <Card
        className={cn(
          "overflow-hidden",
          isClaimed ? "border-success bg-success/5" : "border-primary/30"
        )}
      >
        <CardContent className="p-6 text-center space-y-4">
          <div className="space-y-1">
            <div className="text-5xl">{claim.giftImageUrl || "🎁"}</div>
            <div className="font-semibold">{claim.giftName}</div>
            <div className="text-xs text-muted-foreground">📍 {claim.warehouseName}</div>
          </div>

          {isClaimed ? (
            <div>
              <Badge variant="success" className="text-sm px-3 py-1">
                <Check className="w-3.5 h-3.5 mr-1" /> 已领取
              </Badge>
            </div>
          ) : (
            <>
              {qrDataUrl && (
                <div className="bg-white rounded-2xl p-4 inline-block shadow-sm border">
                  <img src={qrDataUrl} alt="核销二维码" className="w-44 h-44" />
                </div>
              )}
              <div>
                <div className="text-xs text-muted-foreground mb-1">核销码（任选一种出示）</div>
                <div className="font-mono text-3xl font-bold tracking-[0.3em] text-primary">
                  {claim.claimCode}
                </div>
              </div>
              <div className="text-xs text-muted-foreground">
                请于 <span className="text-foreground font-medium">{formatDate(endAt)}</span> 前到 <span className="text-foreground font-medium">{claim.warehouseName}</span> 出示二维码或核销码
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {!isClaimed && (
        <Button
          variant="outline"
          onClick={onCancel}
          disabled={cancelling}
          className="w-full text-muted-foreground"
        >
          {cancelling ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />}
          取消预约
        </Button>
      )}
    </div>
  );
}
