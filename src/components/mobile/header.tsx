"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Gift, LogOut, Bell } from "lucide-react";

export function MobileHeader({ userName, buildingName }: { userName: string; buildingName: string | null }) {
  const router = useRouter();
  const [unread, setUnread] = useState(0);

  // 轻量轮询未读数
  useEffect(() => {
    let cancelled = false;
    async function fetchUnread() {
      try {
        const res = await fetch("/api/notifications");
        if (res.ok && !cancelled) {
          const data = await res.json();
          setUnread(data.unread || 0);
        }
      } catch {}
    }
    fetchUnread();
    const id = setInterval(fetchUnread, 8000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
  }

  return (
    <header className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b">
      <div className="flex items-center justify-between px-4 py-3">
        <Link href="/m" className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-rose-500 to-orange-500 flex items-center justify-center text-white">
            <Gift className="w-4 h-4" />
          </div>
          <div>
            <div className="text-sm font-semibold leading-none">礼达</div>
            <div className="text-[10px] text-muted-foreground mt-0.5">福利发放</div>
          </div>
        </Link>
        <div className="flex items-center gap-2">
          <Link
            href="/m/messages"
            className="relative w-8 h-8 rounded-full bg-muted hover:bg-muted/70 flex items-center justify-center text-muted-foreground"
            aria-label="消息中心"
          >
            <Bell className="w-3.5 h-3.5" />
            {unread > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-rose-500 text-white text-[9px] font-bold leading-none flex items-center justify-center">
                {unread > 99 ? "99+" : unread}
              </span>
            )}
          </Link>
          <div className="text-right">
            <div className="text-xs font-medium">{userName}</div>
            <div className="text-[10px] text-muted-foreground">{buildingName || "未分配楼宇"}</div>
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
