"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, X, Loader2 } from "lucide-react";

type Option = { value: string; label: string };

export function EmployeeFilters({
  departments,
  buildings,
}: {
  departments: string[];
  buildings: { id: string; name: string }[];
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();

  const [q, setQ] = useState(params.get("q") ?? "");
  const dept = params.get("dept") ?? "";
  const building = params.get("building") ?? "";
  const role = params.get("role") ?? "";
  const status = params.get("status") ?? "";

  const activeCount = [dept, building, role, status, q].filter(Boolean).length;

  // 搜索框防抖：输入停止 300ms 后推 URL
  useEffect(() => {
    const current = params.get("q") ?? "";
    if (q === current) return;
    const t = setTimeout(() => {
      const next = new URLSearchParams(params.toString());
      if (q) next.set("q", q);
      else next.delete("q");
      next.delete("page");
      startTransition(() => router.replace(`?${next.toString()}`));
    }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  function setParam(key: string, value: string) {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    next.delete("page");
    startTransition(() => router.replace(`?${next.toString()}`));
  }

  function clearAll() {
    setQ("");
    startTransition(() => router.replace("?"));
  }

  const ROLES: Option[] = [
    { value: "", label: "全部角色" },
    { value: "admin", label: "管理员" },
    { value: "verifier", label: "核销员" },
    { value: "employee", label: "员工" },
  ];

  const STATUSES: Option[] = [
    { value: "", label: "全部状态" },
    { value: "active", label: "在职" },
    { value: "leave", label: "休假" },
    { value: "resigned", label: "离职" },
  ];

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative flex-1 min-w-[220px] max-w-md">
        <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="搜工号 / 姓名 / 邮箱"
          className="pl-8 pr-8 h-9"
        />
        {q && (
          <button
            type="button"
            onClick={() => setQ("")}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      <Select value={dept} onChange={(v) => setParam("dept", v)}>
        <option value="">全部部门</option>
        {departments.map((d) => (
          <option key={d} value={d}>
            {d}
          </option>
        ))}
      </Select>

      <Select value={building} onChange={(v) => setParam("building", v)}>
        <option value="">全部楼宇</option>
        {buildings.map((b) => (
          <option key={b.id} value={b.id}>
            {b.name}
          </option>
        ))}
      </Select>

      <Select value={role} onChange={(v) => setParam("role", v)}>
        {ROLES.map((r) => (
          <option key={r.value} value={r.value}>
            {r.label}
          </option>
        ))}
      </Select>

      <Select value={status} onChange={(v) => setParam("status", v)}>
        {STATUSES.map((s) => (
          <option key={s.value} value={s.value}>
            {s.label}
          </option>
        ))}
      </Select>

      {activeCount > 0 && (
        <Button variant="ghost" size="sm" onClick={clearAll} className="h-9 text-muted-foreground">
          <X className="w-4 h-4" />
          清除（{activeCount}）
        </Button>
      )}

      {pending && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
    </div>
  );
}

function Select({
  value,
  onChange,
  children,
}: {
  value: string;
  onChange: (v: string) => void;
  children: React.ReactNode;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-9 rounded-lg border border-input bg-background px-2.5 pr-7 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring appearance-none bg-[length:14px] bg-[right_8px_center] bg-no-repeat"
      style={{
        backgroundImage:
          "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='none' stroke='%23888' stroke-width='1.5' d='M2.5 4.5l3.5 3.5 3.5-3.5'/%3E%3C/svg%3E\")",
      }}
    >
      {children}
    </select>
  );
}

export function EmployeePagination({
  page,
  pageSize,
  total,
}: {
  page: number;
  pageSize: number;
  total: number;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  function go(p: number) {
    if (p < 1 || p > totalPages || p === page) return;
    const next = new URLSearchParams(params.toString());
    if (p === 1) next.delete("page");
    else next.set("page", String(p));
    startTransition(() => router.replace(`?${next.toString()}`));
  }

  function setSize(s: number) {
    const next = new URLSearchParams(params.toString());
    next.set("pageSize", String(s));
    next.delete("page");
    startTransition(() => router.replace(`?${next.toString()}`));
  }

  // 页码摘要：当前 ± 2 + 首末
  const pages: (number | "...")[] = [];
  for (let i = 1; i <= totalPages; i++) {
    if (i === 1 || i === totalPages || Math.abs(i - page) <= 2) pages.push(i);
    else if (pages[pages.length - 1] !== "...") pages.push("...");
  }

  return (
    <div className="flex items-center justify-between gap-3 px-4 py-3 border-t text-sm flex-wrap">
      <div className="text-muted-foreground tabular-nums">
        共 {total} 条 · 第 {from}–{to}
        {pending && <Loader2 className="w-3 h-3 animate-spin inline ml-2" />}
      </div>

      <div className="flex items-center gap-1">
        <select
          value={pageSize}
          onChange={(e) => setSize(Number(e.target.value))}
          className="h-8 rounded-md border border-input bg-background px-2 text-xs mr-2"
        >
          {[20, 50, 100, 200].map((n) => (
            <option key={n} value={n}>
              {n} 条/页
            </option>
          ))}
        </select>
        <PageBtn disabled={page <= 1} onClick={() => go(page - 1)}>
          上一页
        </PageBtn>
        {pages.map((p, i) =>
          p === "..." ? (
            <span key={`e${i}`} className="px-2 text-muted-foreground">
              …
            </span>
          ) : (
            <PageBtn key={p} active={p === page} onClick={() => go(p)}>
              {p}
            </PageBtn>
          )
        )}
        <PageBtn disabled={page >= totalPages} onClick={() => go(page + 1)}>
          下一页
        </PageBtn>
      </div>
    </div>
  );
}

function PageBtn({
  children,
  active,
  disabled,
  onClick,
}: {
  children: React.ReactNode;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={
        "min-w-[32px] h-8 px-2 rounded-md text-xs border transition-colors " +
        (active
          ? "bg-primary text-primary-foreground border-primary"
          : "border-input bg-background hover:bg-muted disabled:opacity-40 disabled:hover:bg-background disabled:cursor-not-allowed")
      }
    >
      {children}
    </button>
  );
}
