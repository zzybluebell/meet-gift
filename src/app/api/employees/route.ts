import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";

export async function POST(req: Request) {
  try {
    await requireRole(["admin"]);
    const body = await req.json();
    const {
      employeeNo,
      name,
      gender,
      department,
      buildingId,
      hireDate,
      birthDate,
      hasChildren,
      role,
      email,
    } = body;

    if (!employeeNo?.trim() || !name?.trim() || !department?.trim() || !hireDate) {
      return NextResponse.json({ error: "工号 / 姓名 / 部门 / 入职日期 必填" }, { status: 400 });
    }

    if (!["employee", "admin", "verifier"].includes(role || "employee")) {
      return NextResponse.json({ error: "角色无效" }, { status: 400 });
    }

    if (role === "verifier" && !buildingId) {
      return NextResponse.json({ error: "核销员必须指定楼宇" }, { status: 400 });
    }

    // 工号唯一性
    const existing = await prisma.employee.findUnique({ where: { employeeNo: employeeNo.trim() } });
    if (existing) {
      return NextResponse.json({ error: `工号 ${employeeNo} 已存在` }, { status: 409 });
    }

    const employee = await prisma.employee.create({
      data: {
        employeeNo: employeeNo.trim(),
        name: name.trim(),
        gender: gender || "M",
        department: department.trim(),
        buildingId: buildingId || null,
        hireDate: new Date(hireDate),
        birthDate: birthDate ? new Date(birthDate) : null,
        hasChildren: !!hasChildren,
        role: role || "employee",
        email: email?.trim() || null,
        status: "active",
      },
    });

    return NextResponse.json({ ok: true, id: employee.id });
  } catch (e: any) {
    if (e.message === "UNAUTHORIZED") return NextResponse.json({ error: "请先登录" }, { status: 401 });
    if (e.message === "FORBIDDEN") return NextResponse.json({ error: "权限不足" }, { status: 403 });
    console.error(e);
    return NextResponse.json({ error: e.message || "服务器错误" }, { status: 500 });
  }
}
