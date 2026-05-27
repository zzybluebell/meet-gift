import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/admin/page-header";
import { NewEmployeeButton, EditEmployeeButton } from "@/components/admin/employee-dialog";
import { EmployeeFilters, EmployeePagination } from "@/components/admin/employee-filters";
import { Empty } from "@/components/ui/empty";
import { formatDateShort, tenureYears } from "@/lib/utils";
import { ShieldCheck, ScanLine, Gift, Users } from "lucide-react";

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

type SearchParams = {
  q?: string;
  dept?: string;
  building?: string;
  role?: string;
  status?: string;
  page?: string;
  pageSize?: string;
};

export default async function EmployeesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const q = (sp.q ?? "").trim();
  const dept = sp.dept ?? "";
  const buildingId = sp.building ?? "";
  const role = sp.role ?? "";
  const status = sp.status ?? "";
  const page = Math.max(1, Number(sp.page) || 1);
  const pageSize = Math.min(200, Math.max(10, Number(sp.pageSize) || 20));

  const where: Prisma.EmployeeWhereInput = {};
  if (q) {
    where.OR = [
      { name: { contains: q } },
      { employeeNo: { contains: q } },
      { email: { contains: q } },
    ];
  }
  if (dept) where.department = dept;
  if (buildingId) where.buildingId = buildingId;
  if (role) where.role = role;
  if (status) where.status = status;

  // 全局统计（不受筛选影响，给管理员一个稳定的总览）
  // + 筛选后的总数和分页数据
  const [
    statsAll,
    statsActive,
    statsAdmins,
    statsVerifiers,
    statsFemale,
    statsHasChildren,
    byBuildingRaw,
    allDepartments,
    buildings,
    filteredTotal,
    employees,
  ] = await Promise.all([
    prisma.employee.count(),
    prisma.employee.count({ where: { status: "active" } }),
    prisma.employee.count({ where: { role: "admin", status: "active" } }),
    prisma.employee.count({ where: { role: "verifier", status: "active" } }),
    prisma.employee.count({ where: { gender: "F", status: "active" } }),
    prisma.employee.count({ where: { hasChildren: true, status: "active" } }),
    prisma.employee.groupBy({
      by: ["buildingId"],
      where: { status: "active" },
      _count: { _all: true },
    }),
    prisma.employee.findMany({
      distinct: ["department"],
      select: { department: true },
      orderBy: { department: "asc" },
    }),
    prisma.building.findMany({ orderBy: { name: "asc" } }),
    prisma.employee.count({ where }),
    prisma.employee.findMany({
      where,
      include: { building: true, _count: { select: { claims: true } } },
      orderBy: [{ status: "asc" }, { employeeNo: "asc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  const buildingNameById = new Map(buildings.map((b) => [b.id, b.name]));
  const byBuilding = byBuildingRaw
    .filter((r) => r.buildingId)
    .map((r) => ({
      name: buildingNameById.get(r.buildingId!) ?? r.buildingId!,
      count: r._count._all,
    }));

  const buildingsForDialog = buildings.map((b) => ({ id: b.id, name: b.name }));
  const departments = allDepartments.map((d) => d.department).filter(Boolean);

  const hasFilter = !!(q || dept || buildingId || role || status);
  const totalPages = Math.max(1, Math.ceil(filteredTotal / pageSize));
  const pageOutOfRange = filteredTotal > 0 && page > totalPages;

  return (
    <div className="p-8">
      <PageHeader
        title="员工名单 · 权限管理"
        desc={`共 ${statsAll} 人 · 在职 ${statsActive} · 管理员 ${statsAdmins} · 核销员 ${statsVerifiers}`}
        actions={<NewEmployeeButton buildings={buildingsForDialog} />}
      />

      {/* 关键统计 */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground">在职人数</div>
            <div className="text-xl font-semibold mt-1">{statsActive}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground flex items-center gap-1">
              <ShieldCheck className="w-3 h-3 text-blue-600" />
              管理员
            </div>
            <div className="text-xl font-semibold mt-1">{statsAdmins}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground flex items-center gap-1">
              <ScanLine className="w-3 h-3 text-emerald-600" />
              核销员
            </div>
            <div className="text-xl font-semibold mt-1">{statsVerifiers}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground">女员工</div>
            <div className="text-xl font-semibold mt-1">{statsFemale}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground">有娃员工</div>
            <div className="text-xl font-semibold mt-1">{statsHasChildren}</div>
          </CardContent>
        </Card>
      </div>

      {/* 楼宇分布 */}
      {byBuilding.length > 0 && (
        <Card className="mb-4">
          <CardContent className="p-4">
            <div className="text-sm font-medium mb-3">楼宇分布</div>
            <div className="grid grid-cols-3 gap-3">
              {byBuilding.map((b) => (
                <div key={b.name} className="rounded-lg bg-muted/40 p-3">
                  <div className="text-xs text-muted-foreground truncate">{b.name}</div>
                  <div className="text-lg font-semibold mt-0.5">{b.count} 人</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* 筛选条 */}
      <Card className="mb-3">
        <CardContent className="p-3">
          <EmployeeFilters departments={departments} buildings={buildingsForDialog} />
        </CardContent>
      </Card>

      {/* 员工表格 */}
      <Card>
        <CardContent className="p-0">
          {employees.length === 0 ? (
            pageOutOfRange ? (
              <Empty
                icon={<Users className="w-10 h-10" />}
                title={`本页无数据（共 ${totalPages} 页 · 当前第 ${page} 页）`}
                desc="第几页超出范围了，点下面回第 1 页"
                action={
                  <a
                    href={`?${new URLSearchParams({ ...(q && { q }), ...(dept && { dept }), ...(buildingId && { building: buildingId }), ...(role && { role }), ...(status && { status }) }).toString()}`}
                    className="text-sm text-primary hover:underline mt-2"
                  >
                    回第 1 页 →
                  </a>
                }
              />
            ) : (
              <Empty
                icon={<Users className="w-10 h-10" />}
                title={hasFilter ? "没有符合条件的员工" : "还没有员工"}
                desc={hasFilter ? "试试清除筛选或换个关键字" : "点击右上角「添加员工」录入第一位员工"}
              />
            )
          ) : (
            <>
              <div className="overflow-x-auto">
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
              </div>
              <EmployeePagination page={page} pageSize={pageSize} total={filteredTotal} />
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
