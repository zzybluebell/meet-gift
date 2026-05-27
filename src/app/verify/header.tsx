"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ScanLine, LogOut } from "lucide-react";

export function VerifyHeader({ userName, buildingName }: { userName: string; buildingName: string | null }) {
  const router = useRouter();
  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
  }
  return (
    <header className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b">
      <div className="flex items-center justify-between px-4 py-3">
        <Link href="/verify" className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center text-white">
            <ScanLine className="w-4 h-4" />
          </div>
          <div>
            <div className="text-sm font-semibold leading-none">核销台</div>
            <div className="text-[10px] text-muted-foreground mt-0.5">{buildingName || "未分配"}</div>
          </div>
        </Link>
        <div className="flex items-center gap-2">
          <div className="text-right text-xs">
            <div className="font-medium">{userName}</div>
          </div>
          <button
            onClick={logout}
            className="w-8 h-8 rounded-full bg-muted hover:bg-muted/70 flex items-center justify-center text-muted-foreground"
            aria-label="退出"
          >
            <LogOut className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </header>
  );
}
