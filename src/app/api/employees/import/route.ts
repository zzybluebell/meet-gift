import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import * as XLSX from "xlsx";

// Vercel: 给批量导入更长超时（hobby 上限 10s，pro 60s；这里写 60 是 pro 友好）
export const maxDuration = 60;

type RowError = { row: number; employeeNo: string; reason: string };
type ImportSummary = {
  ok: true;
  totalRows: number;
  created: number;
  skipped: number;
  overwritten: number;
  errors: RowError[];
  mode: "strict" | "skip" | "overwrite";
};

const VALID_ROLES = new Set(["employee", "admin", "verifier"]);
const VALID_GENDERS = new Set(["M", "F", "Other"]);

// 列名兼容：表头允许带 " *"、用中文或英文
function pickCol(row: Record<string, any>, candidates: string[]): string {
  for (const c of candidates) {
    if (row[c] != null && String(row[c]).trim()) return String(row[c]).trim();
    if (row[c + " *"] != null && String(row[c + " *"]).trim()) return String(row[c + " *"]).trim();
  }
  return "";
}

// Excel 日期可能是数字（序列号）或字符串。统一转 YYYY-MM-DD
function parseDate(raw: any): Date | null {
  if (raw == null || raw === "") return null;
  if (typeof raw === "number") {
    // Excel 1900 epoch — XLSX 库提供 SSF.parse_date_code
    const parsed = (XLSX as any).SSF?.parse_date_code?.(raw);
    if (parsed) {
      return new Date(Date.UTC(parsed.y, parsed.m - 1, parsed.d));
    }
  }
  const s = String(raw).trim();
  // 兼容 YYYY-MM-DD、YYYY/MM/DD
  const m = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (m) {
    const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
    if (!isNaN(d.getTime())) return d;
  }
  // 退路：让 Date 自己试
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

function parseBool(raw: any): boolean {
  if (raw == null) return false;
  const s = String(raw).trim();
  return ["是", "y", "yes", "true", "1", "✓"].includes(s.toLowerCase());
}

function parseGender(raw: any): string {
  const s = String(raw ?? "").trim();
  if (s === "男" || s === "M" || s === "m") return "M";
  if (s === "女" || s === "F" || s === "f") return "F";
  if (!s) return "__EMPTY__"; // 空值不再静默归 M，让校验报错
  return s; // 保留原值，让后续 enum 校验报错
}

function parseRole(raw: any): string {
  const s = String(raw ?? "").trim().toLowerCase();
  if (!s) return "employee";
  return s;
}

export async function POST(req: Request) {
  try {
    await requireRole(["admin"]);

    const form = await req.formData();
    const file = form.get("file") as File | null;
    const mode = (form.get("mode") as ImportSummary["mode"]) || "skip";
    if (!["strict", "skip", "overwrite"].includes(mode)) {
      return NextResponse.json({ error: "mode 无效（应为 strict / skip / overwrite）" }, { status: 400 });
    }
    if (!file) return NextResponse.json({ error: "请上传 Excel 文件" }, { status: 400 });

    const buffer = Buffer.from(await file.arrayBuffer());
    const wb = XLSX.read(buffer, { type: "buffer", cellDates: false });

    // 优先用名为「员工档案」的 sheet；找不到用第 0 个
    const sheetName =
      wb.SheetNames.find((n) => n === "员工档案" || n === "Employees" || n === "员工") ||
      wb.SheetNames[0];
    const sheet = wb.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json<Record<string, any>>(sheet, { defval: "" });

    // 预拉：所有楼宇按 normalize 后的名称索引（去掉所有空格 + 小写，容忍 Excel 输入差异）
    const buildings = await prisma.building.findMany();
    const normName = (s: string) => s.replace(/\s+/g, "").toLowerCase();
    const buildingByName = new Map(buildings.map((b) => [normName(b.name), b]));

    const errors: RowError[] = [];
    const toCreate: any[] = [];
    const toOverwrite: { employeeNo: string; data: any }[] = [];
    let skipped = 0;

    // 先一次性查所有目标工号是否已存在
    const allParsedNos = rows
      .map((r) => pickCol(r, ["工号", "employeeNo", "employee_no", "EmployeeNo"]))
      .filter(Boolean);
    const existingEmps = await prisma.employee.findMany({
      where: { employeeNo: { in: allParsedNos } },
      select: { id: true, employeeNo: true },
    });
    const existingByNo = new Map(existingEmps.map((e) => [e.employeeNo, e.id]));

    rows.forEach((row, idx) => {
      const excelRow = idx + 2; // Excel 行号 = 索引 + 2（表头算 1 行）
      const employeeNo = pickCol(row, ["工号", "employeeNo", "employee_no", "EmployeeNo"]);
      const name = pickCol(row, ["姓名", "name", "Name"]);
      const department = pickCol(row, ["部门", "department", "Department"]);
      const buildingName = pickCol(row, ["楼宇", "building", "Building"]);
      const hireDateRaw = row["入职日期"] ?? row["入职日期 *"] ?? row["hireDate"] ?? row["HireDate"];
      const birthDateRaw = row["出生日期"] ?? row["birthDate"] ?? row["BirthDate"];
      const email = pickCol(row, ["邮箱", "email", "Email"]);
      const gender = parseGender(row["性别"] ?? row["gender"] ?? row["Gender"]);
      const hasChildren = parseBool(row["有娃"] ?? row["hasChildren"] ?? row["HasChildren"]);
      const role = parseRole(row["角色"] ?? row["role"] ?? row["Role"]);

      // 必填校验
      if (!employeeNo) return errors.push({ row: excelRow, employeeNo: "", reason: "工号必填" });
      if (!name) return errors.push({ row: excelRow, employeeNo, reason: "姓名必填" });
      if (!department) return errors.push({ row: excelRow, employeeNo, reason: "部门必填" });

      // 日期
      const hireDate = parseDate(hireDateRaw);
      if (!hireDate) return errors.push({ row: excelRow, employeeNo, reason: "入职日期格式错误（应为 YYYY-MM-DD）" });
      let birthDate: Date | null = null;
      if (birthDateRaw) {
        birthDate = parseDate(birthDateRaw);
        if (!birthDate) return errors.push({ row: excelRow, employeeNo, reason: "出生日期格式错误（应为 YYYY-MM-DD）" });
      }

      // 枚举
      if (gender === "__EMPTY__") {
        return errors.push({ row: excelRow, employeeNo, reason: "性别必填（M / F 或 男 / 女）" });
      }
      if (!VALID_GENDERS.has(gender)) {
        return errors.push({ row: excelRow, employeeNo, reason: `性别无效（${gender}），应为 M/F/Other` });
      }
      if (!VALID_ROLES.has(role)) {
        return errors.push({ row: excelRow, employeeNo, reason: `角色无效（${role}），应为 employee/admin/verifier` });
      }

      // 楼宇（normalize 后匹配，不存在则按角色决定阻止或留空+警告）
      let buildingId: string | null = null;
      if (buildingName) {
        const b = buildingByName.get(normName(buildingName));
        if (b) buildingId = b.id;
        else {
          if (role === "verifier") {
            return errors.push({ row: excelRow, employeeNo, reason: `楼宇「${buildingName}」不存在，核销员必须分配已有楼宇` });
          }
          // 非 verifier：作为警告记录到 errors（不阻止写入，但提示 admin），buildingId 留 null
          errors.push({
            row: excelRow,
            employeeNo,
            reason: `⚠️ 楼宇「${buildingName}」不存在，已保存但未分配楼宇`,
          });
        }
      } else if (role === "verifier") {
        return errors.push({ row: excelRow, employeeNo, reason: "核销员必须指定楼宇" });
      }

      // 邮箱（如果填了，简单校验）
      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return errors.push({ row: excelRow, employeeNo, reason: `邮箱格式错误：${email}` });
      }

      const data = {
        employeeNo,
        name,
        gender,
        department,
        buildingId,
        hireDate,
        birthDate,
        hasChildren,
        role,
        email: email || null,
        status: "active",
      };

      // 工号冲突按 mode 处理
      if (existingByNo.has(employeeNo)) {
        if (mode === "strict") {
          return errors.push({ row: excelRow, employeeNo, reason: "工号已存在（严格模式禁止重复）" });
        }
        if (mode === "skip") {
          skipped++;
          return;
        }
        // overwrite
        toOverwrite.push({ employeeNo, data });
      } else {
        toCreate.push(data);
      }
    });

    // 严格模式：有任何错就整体回滚，啥也不写
    if (mode === "strict" && errors.length > 0) {
      return NextResponse.json<ImportSummary>({
        ok: true,
        totalRows: rows.length,
        created: 0,
        skipped: 0,
        overwritten: 0,
        errors,
        mode,
      });
    }

    // 写入：不包大事务（libsql 远程 HTTP 长交互式事务在 Vercel serverless 容易超时）。
    // createMany 一次 batch + update 逐条；任何一条失败补到 errors 数组，已写入的保留。
    if (toCreate.length > 0) {
      // 大批量按 500 一批，控制单次 batch 大小避免 libsql 请求过大
      const CHUNK = 500;
      for (let i = 0; i < toCreate.length; i += CHUNK) {
        await prisma.employee.createMany({ data: toCreate.slice(i, i + CHUNK) });
      }
    }
    for (const o of toOverwrite) {
      try {
        await prisma.employee.update({
          where: { employeeNo: o.employeeNo },
          data: {
            name: o.data.name,
            gender: o.data.gender,
            department: o.data.department,
            buildingId: o.data.buildingId,
            hireDate: o.data.hireDate,
            birthDate: o.data.birthDate,
            hasChildren: o.data.hasChildren,
            role: o.data.role,
            email: o.data.email,
          },
        });
      } catch (err: any) {
        errors.push({
          row: 0, // overwrite 的 row 信息已散失，给个 0 占位
          employeeNo: o.employeeNo,
          reason: `覆盖失败：${err.message || "未知错误"}`,
        });
      }
    }

    return NextResponse.json<ImportSummary>({
      ok: true,
      totalRows: rows.length,
      created: toCreate.length,
      skipped,
      overwritten: toOverwrite.length,
      errors,
      mode,
    });
  } catch (e: any) {
    if (e.message === "UNAUTHORIZED") return NextResponse.json({ error: "请先登录" }, { status: 401 });
    if (e.message === "FORBIDDEN") return NextResponse.json({ error: "权限不足" }, { status: 403 });
    console.error(e);
    return NextResponse.json({ error: e.message || "服务器错误" }, { status: 500 });
  }
}
