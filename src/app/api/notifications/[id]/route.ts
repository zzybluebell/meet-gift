import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "请先登录" }, { status: 401 });

    const { id } = await params;
    const { action } = await req.json(); // "read" | "clicked"

    const notif = await prisma.notification.findUnique({ where: { id } });
    if (!notif || notif.employeeId !== user.id) {
      return NextResponse.json({ error: "通知不存在" }, { status: 404 });
    }

    const updates: any = {};
    const now = new Date();

    if (action === "read" && notif.status === "sent") {
      updates.status = "read";
      updates.readAt = now;
    } else if (action === "clicked") {
      updates.status = "clicked";
      updates.clickedAt = now;
      if (!notif.readAt) updates.readAt = now;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ ok: true, noChange: true });
    }

    await prisma.notification.update({ where: { id }, data: updates });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "服务器错误" }, { status: 500 });
  }
}
