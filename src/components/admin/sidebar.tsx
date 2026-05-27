"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Megaphone,
  Package,
  Warehouse,
  Users,
  Building2,
  LogOut,
  Gift,
  Bell,
} from "lucide-react";

const items = [
  { href: "/admin", label: "看板", icon: LayoutDashboard, exact: true },
  { href: "/admin/campaigns", label: "活动批次", icon: Megaphone },
  { href: "/admin/notifications", label: "推送中心", icon: Bell },
  { href: "/admin/gifts", label: "礼物 SKU", icon: Package },
  { href: "/admin/inventory", label: "库存管理", icon: Warehouse },
  { href: "/admin/employees", label: "员工名单", icon: Users },
  { href: "/admin/buildings", label: "楼宇分仓", icon: Building2 },
];

export function AdminSidebar({ userName }: { userName: string }) {
  const pathname = usePathname();
  const router = useRouter();

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
  }

  return (
    <aside className="w-60 border-r bg-background flex flex-col h-screen sticky top-0">
      <div className="p-5 border-b">
        <Link href="/admin" className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-rose-500 to-orange-500 flex items-center justify-center text-white">
            <Gift className="w-5 h-5" />
          </div>
          <div>
            <div className="font-semibold text-sm leading-none">礼达</div>
            <div className="text-[11px] text-muted-foreground mt-1">管理后台</div>
          </div>
        </Link>
      </div>
      <nav className="flex-1 p-3 space-y-1 overflow-auto">
        {items.map((item) => {
          const Icon = item.icon;
          const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors",
                active
                  ? "bg-primary/10 text-primary font-medium"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <Icon className="w-4 h-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="p-3 border-t">
        <div className="px-3 py-2 text-xs text-muted-foreground mb-2">
          当前登录：<span className="text-foreground font-medium">{userName}</span>
        </div>
        <button
          onClick={logout}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <LogOut className="w-4 h-4" />
          退出登录
        </button>
      </div>
    </aside>
  );
}
