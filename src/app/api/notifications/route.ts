import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

// 当前用户的通知列表
export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "请先登录" }, { status: 401 });

    const notifications = await prisma.notification.findMany({
      where: { employeeId: user.id, status: { in: ["sent", "read", "clicked"] } },
      include: {
        campaign: { select: { id: true, name: true, holidayType: true, status: true } },
      },
      orderBy: [{ sentAt: "desc" }, { queuedAt: "desc" }],
    });

    const unread = notifications.filter((n) => n.status === "sent").length;

    return NextResponse.json({ notifications, unread });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "服务器错误" }, { status: 500 });
  }
}
