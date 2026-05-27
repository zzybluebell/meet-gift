import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import * as XLSX from "xlsx";

// 接受 multipart/form-data with field "file" (excel) and "mode" (replace|append)
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireRole(["admin"]);
    const { id: campaignId } = await params;

    const form = await req.formData();
    const file = form.get("file") as File | null;
    const mode = (form.get("mode") as string) || "replace"; // replace | append

    if (!file) return NextResponse.json({ error: "请上传 Excel 文件" }, { status: 400 });

    const buffer = Buffer.from(await file.arrayBuffer());
    const wb = XLSX.read(buffer, { type: "buffer" });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json<Record<string, any>>(sheet, { defval: "" });

    // 抓出工号：兼容多种列名
    const employeeNos: string[] = [];
    for (const row of rows) {
      const no =
        row["工号"] ||
        row["employeeNo"] ||
        row["employee_no"] ||
        row["EmployeeNo"] ||
        row["工号 *"] ||
        Object.values(row)[0]; // 第一列兜底
      if (no != null && String(no).trim()) {
        employeeNos.push(String(no).trim());
      }
    }

    if (employeeNos.length === 0) {
      return NextResponse.json({ error: "未找到任何工号。表头需包含'工号'列" }, { status: 400 });
    }

    const employees = await prisma.employee.findMany({
      where: { employeeNo: { in: employeeNos } },
    });
    const found = new Set(employees.map((e) => e.employeeNo));
    const notFound = employeeNos.filter((no) => !found.has(no));

    if (mode === "replace") {
      // 删除已有的、再创建新的
      await prisma.eligibility.deleteMany({
        where: { campaignId, status: { in: ["eligible", "excluded"] } },
      });
    }

    // 仅对未领的人写入
    const existing = await prisma.eligibility.findMany({
      where: {
        campaignId,
        employeeId: { in: employees.map((e) => e.id) },
      },
      select: { employeeId: true },
    });
    const existingIds = new Set(existing.map((e) => e.employeeId));
    const toCreate = employees.filter((e) => !existingIds.has(e.id));

    if (toCreate.length > 0) {
      await prisma.eligibility.createMany({
        data: toCreate.map((e) => ({
          campaignId,
          employeeId: e.id,
          status: "eligible",
        })),
      });
    }

    return NextResponse.json({
      ok: true,
      received: employeeNos.length,
      matched: employees.length,
      created: toCreate.length,
      notFound,
      mode,
    });
  } catch (e: any) {
    if (e.message === "UNAUTHORIZED") return NextResponse.json({ error: "请先登录" }, { status: 401 });
    if (e.message === "FORBIDDEN") return NextResponse.json({ error: "权限不足" }, { status: 403 });
    console.error(e);
    return NextResponse.json({ error: e.message || "服务器错误" }, { status: 500 });
  }
}
