import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { setSession } from "@/lib/auth";

export async function POST(req: Request) {
  try {
    const { employeeNo } = await req.json();
    if (!employeeNo || typeof employeeNo !== "string") {
      return NextResponse.json({ error: "请填写工号" }, { status: 400 });
    }
    const employee = await prisma.employee.findUnique({
      where: { employeeNo: employeeNo.trim() },
    });
    if (!employee) {
      return NextResponse.json({ error: "工号不存在" }, { status: 404 });
    }
    if (employee.status !== "active") {
      return NextResponse.json({ error: "账号已停用" }, { status: 403 });
    }
    await setSession(employee.id);
    return NextResponse.json({
      ok: true,
      user: { id: employee.id, name: employee.name, role: employee.role },
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "服务器错误" }, { status: 500 });
  }
}
