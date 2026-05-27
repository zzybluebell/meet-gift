"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScanLine, Keyboard, Camera, X, CheckCircle2, AlertTriangle, Loader2, Users } from "lucide-react";
import { cn } from "@/lib/utils";

type PendingClaim = {
  id: string;
  claimCode: string;
  employeeName: string;
  employeeNo: string;
  giftName: string;
  giftEmoji: string;
  campaignName: string;
  reservedAt: string;
};

type Stats = {
  pending: number;
  todayClaimed: number;
  inventories: { giftName: string; emoji: string; available: number; reserved: number; claimed: number }[];
};

type VerifyResult = {
  ok: boolean;
  message: string;
  detail?: {
    employeeName: string;
    employeeNo: string;
    giftName: string;
    giftEmoji: string;
    campaignName: string;
    warehouseName: string;
  };
};

export function VerifyClient({
  warehouseName,
  pendingClaims,
  stats,
}: {
  warehouseName: string;
  pendingClaims: PendingClaim[];
  stats: Stats;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<"input" | "scan">("input");
  const [code, setCode] = useState("");
  const [result, setResult] = useState<VerifyResult | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const scannerRef = useRef<any>(null);

  async function doVerify(payload: { claimCode?: string; qrToken?: string }) {
    setSubmitting(true);
    const res = await fetch("/api/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    setResult({
      ok: res.ok,
      message: data.error || (res.ok ? "核销成功" : "核销失败"),
      detail: data.detail,
    });
    setSubmitting(false);
    if (res.ok) {
      setCode("");
      router.refresh();
    }
  }

  async function startScanner() {
    setMode("scan");
    setResult(null);
    // 动态导入
    const { Html5Qrcode } = await import("html5-qrcode");
    setTimeout(async () => {
      try {
        const scanner = new Html5Qrcode("qr-reader");
        scannerRef.current = scanner;
        await scanner.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 240, height: 240 } },
          async (decoded) => {
            try {
              const payload = JSON.parse(decoded);
              if (payload.qrToken) {
                await scanner.stop();
                scannerRef.current = null;
                doVerify({ qrToken: payload.qrToken });
                setMode("input");
              }
            } catch {
              /* ignore */
            }
          },
          () => {}
        );
      } catch (e) {
        alert("无法启动摄像头：" + (e as Error).message);
        setMode("input");
      }
    }, 100);
  }

  async function stopScanner() {
    if (scannerRef.current) {
      try {
        await scannerRef.current.stop();
      } catch {}
      scannerRef.current = null;
    }
    setMode("input");
  }

  useEffect(() => {
    return () => {
      if (scannerRef.current) {
        try { scannerRef.current.stop(); } catch {}
      }
    };
  }, []);

  return (
    <div className="px-4 py-4 space-y-4">
      {/* 统计 */}
      <div className="grid grid-cols-2 gap-3">
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground">待核销</div>
            <div className="text-2xl font-semibold mt-0.5 text-warning">{stats.pending}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground">今日已核销</div>
            <div className="text-2xl font-semibold mt-0.5 text-success">{stats.todayClaimed}</div>
          </CardContent>
        </Card>
      </div>

      {/* 核销结果（Toast） */}
      {result && (
        <Card
          className={cn(
            "border-2",
            result.ok
              ? "border-success bg-success/5"
              : "border-destructive bg-destructive/5"
          )}
        >
          <CardContent className="p-4 flex items-start gap-3">
            {result.ok ? (
              <CheckCircle2 className="w-6 h-6 text-success shrink-0 mt-0.5" />
            ) : (
              <AlertTriangle className="w-6 h-6 text-destructive shrink-0 mt-0.5" />
            )}
            <div className="flex-1 min-w-0">
              <div className={cn("font-semibold", result.ok ? "text-success" : "text-destructive")}>
                {result.ok ? "✅ 核销成功" : "❌ " + result.message}
              </div>
              {result.detail && (
                <div className="text-sm mt-1.5 space-y-0.5">
                  <div>
                    <span className="text-muted-foreground">员工：</span>
                    {result.detail.employeeName}
                    <span className="text-muted-foreground ml-1">({result.detail.employeeNo})</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">礼物：</span>
                    {result.detail.giftEmoji} {result.detail.giftName}
                  </div>
                  <div>
                    <span className="text-muted-foreground">活动：</span>
                    {result.detail.campaignName}
                  </div>
                </div>
              )}
            </div>
            <button onClick={() => setResult(null)} className="text-muted-foreground hover:text-foreground">
              <X className="w-4 h-4" />
            </button>
          </CardContent>
        </Card>
      )}

      {/* 核销操作 */}
      {mode === "scan" ? (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div id="qr-reader" className="rounded-xl overflow-hidden" />
            <Button variant="outline" onClick={stopScanner} className="w-full">
              <X className="w-4 h-4" /> 关闭摄像头
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex gap-2">
              <Button onClick={startScanner} className="flex-1" size="lg">
                <Camera className="w-5 h-5" />
                扫码核销
              </Button>
            </div>
            <div className="relative text-center">
              <div className="absolute inset-x-0 top-1/2 border-t border-muted -z-0" />
              <span className="relative bg-card px-3 text-xs text-muted-foreground">或手动输入</span>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (code.trim()) doVerify({ claimCode: code.trim() });
              }}
              className="flex gap-2"
            >
              <Input
                placeholder="6 位核销码"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                inputMode="numeric"
                className="text-lg font-mono tracking-widest text-center h-12"
              />
              <Button type="submit" size="lg" disabled={code.length !== 6 || submitting}>
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Keyboard className="w-4 h-4" />}
                核销
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {/* 库存余量 */}
      <Card>
        <CardContent className="p-4">
          <div className="text-sm font-medium mb-3">本仓库存余量</div>
          <div className="space-y-2">
            {stats.inventories
              .filter((i) => i.available + i.reserved + i.claimed > 0)
              .map((i) => (
                <div key={i.giftName} className="flex items-center gap-3 text-sm">
                  <span className="text-xl">{i.emoji}</span>
                  <div className="flex-1 min-w-0 truncate">{i.giftName}</div>
                  <Badge variant={i.available <= 5 ? "warning" : "muted"}>余 {i.available}</Badge>
                </div>
              ))}
          </div>
        </CardContent>
      </Card>

      {/* 待核销名单 */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="text-sm font-medium">待核销名单</div>
            <Badge variant="warning">{pendingClaims.length}</Badge>
          </div>
          {pendingClaims.length === 0 ? (
            <div className="py-6 text-center text-sm text-muted-foreground">
              <Users className="w-8 h-8 mx-auto mb-2 opacity-40" />
              暂无待核销
            </div>
          ) : (
            <div className="space-y-2">
              {pendingClaims.slice(0, 10).map((c) => (
                <button
                  key={c.id}
                  onClick={() => doVerify({ claimCode: c.claimCode })}
                  className="w-full text-left flex items-center gap-3 p-2.5 rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <span className="text-xl">{c.giftEmoji}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm">
                      <span className="font-medium">{c.employeeName}</span>
                      <span className="text-muted-foreground text-xs ml-1">({c.employeeNo})</span>
                    </div>
                    <div className="text-xs text-muted-foreground truncate">{c.giftName}</div>
                  </div>
                  <div className="font-mono text-xs text-muted-foreground tracking-wider">{c.claimCode}</div>
                </button>
              ))}
              {pendingClaims.length > 10 && (
                <div className="text-xs text-muted-foreground text-center pt-2">
                  还有 {pendingClaims.length - 10} 条...
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
