"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Loader2, RefreshCw, AlertTriangle } from "lucide-react";

export function ExpireButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  async function run() {
    setBusy(true);
    setResult(null);
    const res = await fetch("/api/cron/expire", { method: "POST" });
    const data = await res.json();
    if (data.ok) {
      if (
        data.closedCampaigns === 0 &&
        data.expiredClaims === 0 &&
        data.expiredEligibilities === 0
      ) {
        setResult("✅ 一切正常，没有需要过期的项目");
      } else {
        setResult(
          `✅ 已关闭 ${data.closedCampaigns} 个活动 / 过期 ${data.expiredClaims} 条预约 / 释放 ${data.releasedInventoryCount} 份库存 / 过期 ${data.expiredEligibilities} 条资格`
        );
      }
      router.refresh();
    } else {
      setResult("❌ " + (data.error || "运行失败"));
    }
    setBusy(false);
    setTimeout(() => setResult(null), 6000);
  }

  return (
    <div className="flex items-center gap-3">
      <Button onClick={run} disabled={busy} size="sm" variant="outline">
        {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
        运行过期检查
      </Button>
      {result && (
        <div className="text-xs text-muted-foreground flex items-center gap-1.5">
          {result.startsWith("❌") && <AlertTriangle className="w-3.5 h-3.5 text-destructive" />}
          {result}
        </div>
      )}
    </div>
  );
}
