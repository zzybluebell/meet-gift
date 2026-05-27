import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { setSession } from "@/lib/auth";
import { loginLimiter, rateLimitResponse, getClientIp } from "@/lib/rate-limit";

export async function POST(req: Request) {
  try {
    // 限流：单 IP 1 分钟 10 次（防工号枚举 / 暴力试探）
    const rl = await loginLimiter.check(getClientIp(req));
    const limited = rateLimitResponse(rl);
    if (limited) return limited;

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
