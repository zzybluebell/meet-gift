"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { Empty } from "@/components/ui/empty";
import { Inbox, MessageSquare, ExternalLink } from "lucide-react";

type Item = {
  id: string;
  type: string;
  channel: string;
  status: string;
  title: string;
  content: string;
  ctaUrl: string | null;
  sentAt: string;
  campaign: { id: string; name: string; holidayType: string; status: string };
};

const CHANNEL_META: Record<string, { name: string; color: string; logo: string }> = {
  lark: { name: "飞书", color: "from-[#3370FF] to-[#0852E5]", logo: "🐦" },
  email: { name: "邮件", color: "from-[#525252] to-[#262626]", logo: "✉" },
};

const TYPE_META: Record<string, { tag: string; color: string }> = {
  initial: { tag: "新福利", color: "bg-rose-50 text-rose-600 border-rose-200" },
  reminder_24h: { tag: "24h 催领", color: "bg-amber-50 text-amber-700 border-amber-200" },
  reminder_2h: { tag: "2h 紧急", color: "bg-red-50 text-red-700 border-red-200" },
  last_call: { tag: "行政提醒", color: "bg-purple-50 text-purple-700 border-purple-200" },
  reserved_confirm: { tag: "预约成功", color: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  claimed_confirm: { tag: "已签收", color: "bg-blue-50 text-blue-700 border-blue-200" },
};

const HOLIDAY_EMOJI: Record<string, string> = {
  mid_autumn: "🥮",
  dragon_boat: "🍡",
  spring: "🧧",
  womens: "🌹",
  childrens: "🎈",
  birthday: "🎂",
  tenure: "🏆",
  new_hire: "🎁",
  other: "🎁",
};

function fmtTime(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const diff = (now.getTime() - d.getTime()) / 1000;
  if (diff < 60) return "刚刚";
  if (diff < 3600) return `${Math.floor(diff / 60)} 分钟前`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} 小时前`;
  const isToday = d.toDateString() === now.toDateString();
  if (isToday) return `今天 ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export function MessagesClient({ items: initialItems }: { items: Item[] }) {
  const router = useRouter();
  const [items, setItems] = useState(initialItems);

  async function markRead(id: string) {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, status: "read" } : i)));
    await fetch(`/api/notifications/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "read" }),
    });
  }

  async function clickCta(id: string, url: string) {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, status: "clicked" } : i)));
    await fetch(`/api/notifications/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "clicked" }),
    });
    router.push(url);
  }

  async function markAllRead() {
    const unread = items.filter((i) => i.status === "sent");
    if (unread.length === 0) return;
    setItems((prev) => prev.map((i) => (i.status === "sent" ? { ...i, status: "read" } : i)));
    await Promise.all(
      unread.map((i) =>
        fetch(`/api/notifications/${i.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "read" }),
        })
      )
    );
  }

  const unreadCount = items.filter((i) => i.status === "sent").length;

  return (
    <div className="p-4 space-y-3">
      <div className="flex items-center justify-between mb-2">
        <div>
          <h1 className="text-lg font-semibold">消息中心</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {items.length} 条 · {unreadCount > 0 ? `${unreadCount} 条未读` : "全部已读"}
          </p>
        </div>
        {unreadCount > 0 && (
          <button onClick={markAllRead} className="text-xs text-primary hover:underline">
            全部已读
          </button>
        )}
      </div>

      {items.length === 0 ? (
        <Empty
          icon={<Inbox className="w-10 h-10" />}
          title="还没有消息"
          desc="你的节日福利通知会出现在这里"
        />
      ) : (
        <div className="space-y-2.5">
          {items.map((item) => (
            <MessageCard key={item.id} item={item} onRead={markRead} onClick={clickCta} />
          ))}
        </div>
      )}

      <div className="mt-6 text-center text-[10px] text-muted-foreground">
        💡 真实场景中，这些消息会通过飞书或邮件推送给你
      </div>
    </div>
  );
}

function MessageCard({
  item,
  onRead,
  onClick,
}: {
  item: Item;
  onRead: (id: string) => void;
  onClick: (id: string, url: string) => void;
}) {
  const channel = CHANNEL_META[item.channel] || CHANNEL_META.lark;
  const typeMeta = TYPE_META[item.type] || { tag: item.type, color: "bg-muted text-muted-foreground" };
  const holidayEmoji = HOLIDAY_EMOJI[item.campaign?.holidayType] || "🎁";
  const isUnread = item.status === "sent";

  return (
    <div
      className={cn(
        "rounded-2xl border-2 transition-all cursor-pointer overflow-hidden bg-card",
        isUnread ? "border-primary/30 shadow-sm" : "border-border"
      )}
      onClick={() => isUnread && onRead(item.id)}
    >
      {/* 顶部 IM 渠道条 */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-muted/30 border-b">
        <div className="flex items-center gap-1.5">
          <div
            className={cn(
              "w-4 h-4 rounded-md bg-gradient-to-br text-[9px] flex items-center justify-center text-white shrink-0",
              channel.color
            )}
          >
            {channel.logo}
          </div>
          <span className="text-[10px] text-muted-foreground">{channel.name} · 公司福利助手</span>
        </div>
        <span className="text-[10px] text-muted-foreground">{fmtTime(item.sentAt)}</span>
      </div>

      {/* 卡片主体 — 模拟飞书消息卡 */}
      <div className="p-3.5 space-y-2.5">
        {/* 头部 */}
        <div className="flex items-start gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-rose-500 to-orange-400 flex items-center justify-center text-lg shrink-0">
            {holidayEmoji}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className={cn("text-[10px] px-1.5 py-0.5 rounded border font-medium", typeMeta.color)}>
                {typeMeta.tag}
              </span>
              {isUnread && <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />}
            </div>
            <div className={cn("text-sm mt-1 leading-snug", isUnread ? "font-semibold" : "")}>
              {item.title}
            </div>
          </div>
        </div>

        {/* 内容 */}
        <div className="text-xs text-muted-foreground leading-relaxed pl-[44px]">{item.content}</div>

        {/* CTA */}
        {item.ctaUrl && (
          <div className="pl-[44px] pt-1">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onClick(item.id, item.ctaUrl!);
              }}
              className="inline-flex items-center gap-1.5 text-xs text-primary font-medium hover:underline"
            >
              {item.type === "claimed_confirm" ? "查看详情" : "立即领取"}
              <ExternalLink className="w-3 h-3" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
