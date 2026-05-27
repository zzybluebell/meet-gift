import { prisma } from "@/lib/prisma";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/admin/page-header";
import { NewEmployeeButton, EditEmployeeButton } from "@/components/admin/employee-dialog";
import { formatDateShort, tenureYears } from "@/lib/utils";
import { ShieldCheck, ScanLine, Gift } from "lucide-react";

export const dynamic = "force-dynamic";

const ROLE_META: Record<string, { label: string; variant: "default" | "success" | "muted"; icon: any; color: string }> = {
  admin: { label: "管理员", variant: "default", icon: ShieldCheck, color: "text-blue-600" },
  verifier: { label: "核销员", variant: "success", icon: ScanLine, color: "text-emerald-600" },
  employee: { label: "员工", variant: "muted", icon: Gift, color: "text-slate-500" },
};

const STATUS_META: Record<string, { label: string; variant: "success" | "warning" | "muted" }> = {
  active: { label: "在职", variant: "success" },
  leave: { label: "休假", variant: "warning" },
  resigned: { label: "离职", variant: "muted" },
};

export default async function EmployeesPage() {
  const [employees, buildings] = await Promise.all([
    prisma.employee.findMany({
      include: { building: true, _count: { select: { claims: true } } },
      orderBy: [{ status: "asc" }, { employeeNo: "asc" }],
    }),
    prisma.building.findMany({ orderBy: { name: "asc" } }),
  ]);

  const stats = {
    total: employees.length,
    active: employees.filter((e) => e.status === "active").length,
    admins: employees.filter((e) => e.role === "admin" && e.status === "active").length,
    verifiers: employees.filter((e) => e.role === "verifier" && e.status === "active").length,
    female: employees.filter((e) => e.gender === "F" && e.status === "active").length,
    hasChildren: employees.filter((e) => e.hasChildren && e.status === "active").length,
    byBuilding: new Map<string, number>(),
  };
  for (const e of employees) {
    if (e.status !== "active") continue;
    if (e.building) stats.byBuilding.set(e.building.name, (stats.byBuilding.get(e.building.name) || 0) + 1);
  }

  const buildingsForDialog = buildings.map((b) => ({ id: b.id, name: b.name }));

  return (
    <div className="p-8">
      <PageHeader
        title="员工名单 · 权限管理"
        desc={`共 ${stats.total} 人 · 在职 ${stats.active} · 管理员 ${stats.admins} · 核销员 ${stats.verifiers}`}
        actions={<NewEmployeeButton buildings={buildingsForDialog} />}
      />

      {/* 关键统计 */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground">在职人数</div>
            <div className="text-xl font-semibold mt-1">{stats.active}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground flex items-center gap-1">
              <ShieldCheck className="w-3 h-3 text-blue-600" />
              管理员
            </div>
            <div className="text-xl font-semibold mt-1">{stats.admins}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground flex items-center gap-1">
              <ScanLine className="w-3 h-3 text-emerald-600" />
              核销员
            </div>
            <div className="text-xl font-semibold mt-1">{stats.verifiers}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground">女员工</div>
            <div className="text-xl font-semibold mt-1">{stats.female}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground">有娃员工</div>
            <div className="text-xl font-semibold mt-1">{stats.hasChildren}</div>
          </CardContent>
        </Card>
      </div>

      {/* 楼宇分布 */}
      <Card className="mb-4">
        <CardContent className="p-4">
          <div className="text-sm font-medium mb-3">楼宇分布</div>
          <div className="grid grid-cols-3 gap-3">
            {Array.from(stats.byBuilding.entries()).map(([name, n]) => (
              <div key={name} className="rounded-lg bg-muted/40 p-3">
                <div className="text-xs text-muted-foreground truncate">{name}</div>
                <div className="text-lg font-semibold mt-0.5">{n} 人</div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* 员工表格 */}
      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/30">
                <th className="text-left px-4 py-3 font-medium">工号</th>
                <th className="text-left px-4 py-3 font-medium">姓名</th>
                <th className="text-left px-4 py-3 font-medium">部门</th>
                <th className="text-left px-4 py-3 font-medium">楼宇</th>
                <th className="text-left px-4 py-3 font-medium">司龄</th>
                <th className="text-center px-4 py-3 font-medium">性别</th>
                <th className="text-center px-4 py-3 font-medium">有娃</th>
                <th className="text-left px-4 py-3 font-medium">角色</th>
                <th className="text-left px-4 py-3 font-medium">状态</th>
                <th className="text-right px-4 py-3 font-medium">领取</th>
                <th className="text-right px-4 py-3 font-medium w-12"></th>
              </tr>
            </thead>
            <tbody>
              {employees.map((e) => {
                const roleMeta = ROLE_META[e.role] || ROLE_META.employee;
                const statusMeta = STATUS_META[e.status] || STATUS_META.active;
                const RoleIcon = roleMeta.icon;
                return (
                  <tr key={e.id} className={`border-b last:border-0 hover:bg-muted/20 ${e.status !== "active" ? "opacity-60" : ""}`}>
                    <td className="px-4 py-2.5 font-mono text-xs">{e.employeeNo}</td>
                    <td className="px-4 py-2.5">{e.name}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">{e.department}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">{e.building?.name || "—"}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">
                      {tenureYears(e.hireDate)} 年
                      <span className="text-[11px] ml-1">({formatDateShort(e.hireDate)})</span>
                    </td>
                    <td className="px-4 py-2.5 text-center text-muted-foreground">
                      {e.gender === "F" ? "女" : e.gender === "M" ? "男" : "其他"}
                    </td>
                    <td className="px-4 py-2.5 text-center text-muted-foreground">{e.hasChildren ? "✓" : ""}</td>
                    <td className="px-4 py-2.5">
                      <Badge variant={roleMeta.variant} className="gap-1">
                        <RoleIcon className={`w-3 h-3 ${roleMeta.color}`} />
                        {roleMeta.label}
                      </Badge>
                    </td>
                    <td className="px-4 py-2.5">
                      <Badge variant={statusMeta.variant}>{statusMeta.label}</Badge>
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{e._count.claims}</td>
                    <td className="px-4 py-2.5 text-right">
                      <EditEmployeeButton
                        employee={{
                          id: e.id,
                          employeeNo: e.employeeNo,
                          name: e.name,
                          gender: e.gender,
                          department: e.department,
                          buildingId: e.buildingId,
                          buildingName: e.building?.name || null,
                          hireDate: e.hireDate.toISOString(),
                          birthDate: e.birthDate ? e.birthDate.toISOString() : null,
                          hasChildren: e.hasChildren,
                          role: e.role,
                          status: e.status,
                          email: e.email,
                        }}
                        buildings={buildingsForDialog}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
