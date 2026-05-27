"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Bell, Loader2, Send, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

type FlashState = { text: string; type: "success" | "error" } | null;

export function NotifyActions({ campaignId, runCron }: { campaignId?: string; runCron?: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [flash, setFlash] = useState<FlashState>(null);

  function showFlash(text: string, type: "success" | "error" = "success") {
    setFlash({ text, type });
    setTimeout(() => setFlash(null), 5000);
  }

  async function enqueue(type: "initial" | "last_call") {
    if (!campaignId) return;
    setBusy(type);
    const res = await fetch(`/api/campaigns/${campaignId}/notifications/enqueue`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, onlyUnclaimed: type === "last_call", sendImmediately: true }),
    });
    const data = await res.json();
    if (res.ok) {
      if (data.enqueued === 0) {
        showFlash(`无需触达：所有合格员工已收到（已跳过 ${data.skipped}）`);
      } else {
        showFlash(`已推送 ${data.enqueued} 条 · 成功 ${data.send?.sent ?? 0} / 失败 ${data.send?.failed ?? 0}`);
      }
      router.refresh();
    } else {
      showFlash(data.error || "操作失败", "error");
    }
    setBusy(null);
  }

  async function runCronJob() {
    setBusy("cron");
    const res = await fetch("/api/cron/notifications", { method: "POST" });
    const data = await res.json();
    if (res.ok) {
      const r = data.reminders;
      const f = data.flush;
      showFlash(
        `24h催领 ${r.reminder24h} · 2h催领 ${r.reminder2h} · 已发送 ${f.sent} · 失败 ${f.failed}`
      );
      router.refresh();
    } else {
      showFlash(data.error || "操作失败", "error");
    }
    setBusy(null);
  }

  return (
    <div className="flex items-center gap-2">
      {flash && (
        <div
          className={cn(
            "text-xs px-2.5 py-1.5 rounded-md",
            flash.type === "success" ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"
          )}
        >
          {flash.text}
        </div>
      )}
      {runCron && (
        <Button size="sm" variant="outline" onClick={runCronJob} disabled={!!busy}>
          {busy === "cron" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
          跑一轮催领定时
        </Button>
      )}
      {campaignId && (
        <>
          <Button size="sm" variant="outline" onClick={() => enqueue("initial")} disabled={!!busy}>
            {busy === "initial" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
            重推初次通知
          </Button>
          <Button size="sm" onClick={() => enqueue("last_call")} disabled={!!busy}>
            {busy === "last_call" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Bell className="w-3.5 h-3.5" />}
            手动催领未领者
          </Button>
        </>
      )}
    </div>
  );
}
