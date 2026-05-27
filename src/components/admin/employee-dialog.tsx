"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Loader2, AlertTriangle, ShieldCheck, ScanLine, Gift, Trash2, UserPlus, Pencil } from "lucide-react";

type Building = { id: string; name: string };

type Employee = {
  id: string;
  employeeNo: string;
  name: string;
  gender: string;
  department: string;
  buildingId: string | null;
  buildingName: string | null;
  hireDate: string;
  birthDate: string | null;
  hasChildren: boolean;
  role: string;
  status: string;
  email: string | null;
};

const ROLES = [
  { value: "employee", label: "普通员工", desc: "查看 / 领取福利", icon: Gift, color: "text-slate-600 bg-slate-100" },
  { value: "verifier", label: "分仓核销员", desc: "扫码核销 / 仅本楼宇", icon: ScanLine, color: "text-emerald-600 bg-emerald-50" },
  { value: "admin", label: "行政管理员", desc: "活动 / 库存 / 用户管理", icon: ShieldCheck, color: "text-blue-600 bg-blue-50" },
];

const STATUS_OPTIONS = [
  { value: "active", label: "在职", color: "text-emerald-600 bg-emerald-50" },
  { value: "leave", label: "休假", color: "text-amber-600 bg-amber-50" },
  { value: "resigned", label: "离职", color: "text-rose-600 bg-rose-50" },
];

const GENDERS = [
  { value: "M", label: "男" },
  { value: "F", label: "女" },
];

export function NewEmployeeButton({
  buildings,
  departments,
}: {
  buildings: Building[];
  departments: string[];
}) {
  return <EmployeeDialog mode="create" buildings={buildings} departments={departments} />;
}

export function EditEmployeeButton({
  employee,
  buildings,
  departments,
}: {
  employee: Employee;
  buildings: Building[];
  departments: string[];
}) {
  return (
    <EmployeeDialog mode="edit" employee={employee} buildings={buildings} departments={departments} />
  );
}

function EmployeeDialog({
  mode,
  employee,
  buildings,
  departments,
}: {
  mode: "create" | "edit";
  employee?: Employee;
  buildings: Building[];
  departments: string[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  // 旧数据可能有 "Other" 性别，UI 已不提供这个选项，归一到 M 防止保存又把旧值带回
  const normalizedGender = (g: string | undefined) => (g === "F" ? "F" : "M");

  const [form, setForm] = useState({
    employeeNo: employee?.employeeNo ?? "",
    name: employee?.name ?? "",
    gender: normalizedGender(employee?.gender),
    department: employee?.department ?? "",
    buildingId: employee?.buildingId ?? "",
    hireDate: employee?.hireDate?.slice(0, 10) ?? new Date().toISOString().slice(0, 10),
    birthDate: employee?.birthDate?.slice(0, 10) ?? "",
    hasChildren: employee?.hasChildren ?? false,
    role: employee?.role ?? "employee",
    status: employee?.status ?? "active",
    email: employee?.email ?? "",
  });

  // 重置 form when dialog reopened
  useEffect(() => {
    if (open) {
      setForm({
        employeeNo: employee?.employeeNo ?? "",
        name: employee?.name ?? "",
        gender: normalizedGender(employee?.gender),
        department: employee?.department ?? "",
        buildingId: employee?.buildingId ?? "",
        hireDate: employee?.hireDate?.slice(0, 10) ?? new Date().toISOString().slice(0, 10),
        birthDate: employee?.birthDate?.slice(0, 10) ?? "",
        hasChildren: employee?.hasChildren ?? false,
        role: employee?.role ?? "employee",
        status: employee?.status ?? "active",
        email: employee?.email ?? "",
      });
      setError("");
    }
  }, [open, employee]);

  const needsBuilding = form.role === "verifier";

  async function submit() {
    setSubmitting(true);
    setError("");
    const url = mode === "create" ? "/api/employees" : `/api/employees/${employee!.id}`;
    const method = mode === "create" ? "POST" : "PATCH";
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, buildingId: form.buildingId || null }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "保存失败");
      setSubmitting(false);
      return;
    }
    router.refresh();
    setOpen(false);
    setSubmitting(false);
  }

  async function doDelete() {
    if (!employee) return;
    if (!confirm(`确认删除 ${employee.name}（${employee.employeeNo}）？\n有领取记录的会标记为离职，无记录的会真删`)) return;
    setSubmitting(true);
    const res = await fetch(`/api/employees/${employee.id}`, { method: "DELETE" });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "删除失败");
      setSubmitting(false);
      return;
    }
    if (data.message) alert(data.message);
    router.refresh();
    setOpen(false);
    setSubmitting(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {mode === "create" ? (
          <Button>
            <UserPlus className="w-4 h-4" />
            添加员工
          </Button>
        ) : (
          <Button size="sm" variant="ghost" className="h-7 px-2">
            <Pencil className="w-3.5 h-3.5" />
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {mode === "create" ? "添加新员工" : `编辑 ${employee?.name}`}
          </DialogTitle>
          <DialogDescription>
            {mode === "create"
              ? "新增员工后默认为「普通员工」角色，可在下方调整"
              : "调整员工的角色、楼宇、状态等信息"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* 基本信息 */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>工号 *</Label>
              <Input
                value={form.employeeNo}
                onChange={(e) => setForm({ ...form, employeeNo: e.target.value })}
                disabled={mode === "edit"}
                placeholder="如 50001"
                className="mt-1.5 font-mono"
              />
            </div>
            <div>
              <Label>姓名 *</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="张三"
                className="mt-1.5"
              />
            </div>
            <div>
              <Label>部门 *</Label>
              <Input
                list="employee-dept-suggestions"
                value={form.department}
                onChange={(e) => setForm({ ...form, department: e.target.value })}
                placeholder="如 研发中心"
                className="mt-1.5"
              />
              <datalist id="employee-dept-suggestions">
                {departments.map((d) => (
                  <option key={d} value={d} />
                ))}
              </datalist>
              {departments.length > 0 && (
                <div className="text-[11px] text-muted-foreground mt-1">
                  已有部门：{departments.slice(0, 6).join(" · ")}
                  {departments.length > 6 && ` · 等 ${departments.length} 个`}
                </div>
              )}
            </div>
            <div>
              <Label>性别</Label>
              <div className="grid grid-cols-2 gap-1 mt-1.5">
                {GENDERS.map((g) => (
                  <button
                    key={g.value}
                    type="button"
                    onClick={() => setForm({ ...form, gender: g.value })}
                    className={cn(
                      "h-9 rounded-lg border-2 text-sm transition-all",
                      form.gender === g.value ? "border-primary bg-primary/5" : "border-input hover:border-primary/40"
                    )}
                  >
                    {g.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <Label>入职日期 *</Label>
              <Input
                type="date"
                value={form.hireDate}
                onChange={(e) => setForm({ ...form, hireDate: e.target.value })}
                className="mt-1.5"
              />
            </div>
            <div>
              <Label>出生日期</Label>
              <Input
                type="date"
                value={form.birthDate}
                onChange={(e) => setForm({ ...form, birthDate: e.target.value })}
                className="mt-1.5"
              />
            </div>
            <div className="col-span-2 flex items-center gap-2">
              <input
                type="checkbox"
                id="hasChildren"
                checked={form.hasChildren}
                onChange={(e) => setForm({ ...form, hasChildren: e.target.checked })}
                className="w-4 h-4 rounded"
              />
              <Label htmlFor="hasChildren" className="cursor-pointer">
                有孩子（用于儿童节等差异化福利）
              </Label>
            </div>
          </div>

          {/* 角色 */}
          <div className="pt-3 border-t">
            <Label className="text-base">角色 / 权限</Label>
            <div className="grid grid-cols-1 gap-2 mt-2">
              {ROLES.map((r) => {
                const Icon = r.icon;
                const selected = form.role === r.value;
                return (
                  <button
                    key={r.value}
                    type="button"
                    onClick={() => setForm({ ...form, role: r.value })}
                    className={cn(
                      "flex items-center gap-3 rounded-lg border-2 p-3 text-left transition-all",
                      selected ? "border-primary bg-primary/5" : "border-input hover:border-primary/40"
                    )}
                  >
                    <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center", r.color)}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="flex-1">
                      <div className="font-medium text-sm">{r.label}</div>
                      <div className="text-xs text-muted-foreground">{r.desc}</div>
                    </div>
                    {selected && <Badge variant="default">已选</Badge>}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 楼宇 */}
          <div>
            <Label>所在楼宇 / 分仓 {needsBuilding && <span className="text-destructive">*</span>}</Label>
            {needsBuilding && (
              <div className="text-xs text-muted-foreground mt-0.5 mb-1.5">
                核销员只能核销其所在楼宇的预约
              </div>
            )}
            <div className="grid grid-cols-1 gap-2 mt-1.5">
              {!needsBuilding && (
                <button
                  type="button"
                  onClick={() => setForm({ ...form, buildingId: "" })}
                  className={cn(
                    "p-2 rounded-lg border-2 text-sm text-left transition-all",
                    form.buildingId === "" ? "border-primary bg-primary/5" : "border-input hover:border-primary/40"
                  )}
                >
                  未分配
                </button>
              )}
              {buildings.map((b) => (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => setForm({ ...form, buildingId: b.id })}
                  className={cn(
                    "p-2 rounded-lg border-2 text-sm text-left transition-all",
                    form.buildingId === b.id ? "border-primary bg-primary/5" : "border-input hover:border-primary/40"
                  )}
                >
                  {b.name}
                </button>
              ))}
            </div>
          </div>

          {/* 状态（仅编辑时） */}
          {mode === "edit" && (
            <div>
              <Label className="text-base">在职状态</Label>
              <div className="grid grid-cols-3 gap-2 mt-2">
                {STATUS_OPTIONS.map((s) => (
                  <button
                    key={s.value}
                    type="button"
                    onClick={() => setForm({ ...form, status: s.value })}
                    className={cn(
                      "h-10 rounded-lg border-2 text-sm transition-all",
                      form.status === s.value ? "border-primary bg-primary/5" : "border-input hover:border-primary/40"
                    )}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
              <div className="text-xs text-muted-foreground mt-2">
                ⚠️ 离职/休假员工不能登录、自动从所有进行中活动的资格中移除
              </div>
            </div>
          )}

          {error && (
            <div className="rounded-lg bg-destructive/10 text-destructive px-3 py-2.5 text-sm flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
              {error}
            </div>
          )}
        </div>

        <DialogFooter>
          {mode === "edit" && (
            <Button
              variant="ghost"
              size="sm"
              onClick={doDelete}
              disabled={submitting}
              className="text-destructive hover:text-destructive mr-auto"
            >
              <Trash2 className="w-4 h-4" />
              删除
            </Button>
          )}
          <Button variant="outline" onClick={() => setOpen(false)} disabled={submitting}>
            取消
          </Button>
          <Button onClick={submit} disabled={submitting}>
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            保存
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
