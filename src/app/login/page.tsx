"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Gift } from "lucide-react";
import { Copyright } from "@/components/copyright";

function LoginInner() {
  const router = useRouter();
  const search = useSearchParams();
  const [employeeNo, setEmployeeNo] = useState(search.get("no") || "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // 若 URL 带 ?no=xxx，自动尝试登录（demo 方便）
  useEffect(() => {
    const no = search.get("no");
    if (no && no.length >= 4) {
      doLogin(no);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function doLogin(no: string) {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employeeNo: no }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "登录失败");
        setLoading(false);
        return;
      }
      const role = data.user.role;
      if (role === "admin") router.replace("/admin");
      else if (role === "verifier") router.replace("/verify");
      else router.replace("/m");
    } catch (e) {
      setError("网络错误");
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-slate-50 to-blue-50 p-4 gap-6">
      <Card className="w-full max-w-md">
        <CardContent className="p-8 space-y-6">
          <div className="flex flex-col items-center text-center gap-2">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-rose-500 to-orange-500 flex items-center justify-center text-white shadow-sm">
              <Gift className="w-6 h-6" />
            </div>
            <div className="text-xl font-semibold">礼达 · 福利发放系统</div>
            <div className="text-sm text-muted-foreground">输入工号登录</div>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              doLogin(employeeNo.trim());
            }}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label htmlFor="no">工号</Label>
              <Input
                id="no"
                value={employeeNo}
                onChange={(e) => setEmployeeNo(e.target.value)}
                placeholder="如 10001"
                autoFocus
                className="font-mono"
              />
            </div>

            {error && (
              <div className="text-sm text-destructive bg-destructive/10 rounded-md px-3 py-2">
                {error}
              </div>
            )}

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "登录中..." : "登录"}
            </Button>
          </form>

          <div className="text-xs text-muted-foreground space-y-1 border-t pt-4">
            <div className="font-medium text-foreground mb-1">Demo 账号：</div>
            <div>· 行政管理：10001</div>
            <div>· 分仓核销：20001 / 20002 / 20003</div>
            <div>· 普通员工：30001 / 30002 / 30003</div>
            <div>· 其他随机员工：4xxxx</div>
          </div>
        </CardContent>
      </Card>
      <Copyright />
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-muted-foreground">加载中...</div>}>
      <LoginInner />
    </Suspense>
  );
}
