import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { MessagesClient } from "./client";

export const dynamic = "force-dynamic";

export default async function MessagesPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const notifications = await prisma.notification.findMany({
    where: { employeeId: user.id, status: { in: ["sent", "read", "clicked"] } },
    include: {
      campaign: { select: { id: true, name: true, holidayType: true, status: true } },
    },
    orderBy: [{ sentAt: "desc" }, { queuedAt: "desc" }],
    take: 50,
  });

  const items = notifications.map((n) => ({
    id: n.id,
    type: n.type,
    channel: n.channel,
    status: n.status,
    title: n.title,
    content: n.content,
    ctaUrl: n.ctaUrl,
    sentAt: n.sentAt?.toISOString() || n.queuedAt.toISOString(),
    campaign: n.campaign,
  }));

  return <MessagesClient items={items} />;
}
