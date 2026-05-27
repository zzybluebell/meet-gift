"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

export function CampaignActions({
  id,
  status,
  canDelete,
}: {
  id: string;
  status: string;
  canDelete: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function changeStatus(newStatus: string) {
    setBusy(true);
    await fetch(`/api/campaigns/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
    router.refresh();
    setBusy(false);
  }

  async function doDelete() {
    if (!confirm("确认删除该活动？此操作不可撤销")) return;
    setBusy(true);
    const res = await fetch(`/api/campaigns/${id}`, { method: "DELETE" });
    const data = await res.json();
    if (!res.ok) {
      alert(data.error || "删除失败");
      setBusy(false);
      return;
    }
    router.push("/admin/campaigns");
  }

  return (
    <div className="flex items-center gap-2">
      {busy && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
      {status === "draft" && (
        <Button size="sm" onClick={() => changeStatus("active")} disabled={busy}>
          发布活动
        </Button>
      )}
      {status === "active" && (
        <Button size="sm" variant="outline" onClick={() => changeStatus("closed")} disabled={busy}>
          结束活动
        </Button>
      )}
      {status === "closed" && (
        <Button size="sm" variant="outline" onClick={() => changeStatus("active")} disabled={busy}>
          重新激活
        </Button>
      )}
      {canDelete && (
        <Button size="sm" variant="ghost" onClick={doDelete} disabled={busy} className="text-destructive hover:text-destructive">
          删除
        </Button>
      )}
    </div>
  );
}
