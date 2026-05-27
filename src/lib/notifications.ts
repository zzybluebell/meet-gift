// IM 通知（飞书/钉钉/企微 mock）的调度逻辑
import { prisma } from "./prisma";

export type NotifType =
  | "initial" // 活动开始：你有一份福利
  | "reminder_24h" // 截止前 24h
  | "reminder_2h" // 截止前 2h
  | "last_call" // 行政手动催领
  | "reserved_confirm" // 预约成功
  | "claimed_confirm"; // 核销成功

export type NotifChannel = "lark" | "dingtalk" | "wecom" | "email";

const CHANNEL_LABEL: Record<NotifChannel, string> = {
  lark: "飞书",
  dingtalk: "钉钉",
  wecom: "企业微信",
  email: "邮件",
};

const TYPE_META: Record<NotifType, { titlePrefix: string; emoji: string }> = {
  initial: { titlePrefix: "🎁 你有一份节日福利", emoji: "🎁" },
  reminder_24h: { titlePrefix: "⏰ 24h 内未领取将过期", emoji: "⏰" },
  reminder_2h: { titlePrefix: "🚨 2h 内未领取将过期", emoji: "🚨" },
  last_call: { titlePrefix: "📢 行政提醒：尽快领取节日福利", emoji: "📢" },
  reserved_confirm: { titlePrefix: "✅ 预约成功，请前往领取", emoji: "✅" },
  claimed_confirm: { titlePrefix: "🎉 已成功领取", emoji: "🎉" },
};

// 选员工的默认渠道（mock：按工号尾号轮询）
function pickChannel(employeeNo: string): NotifChannel {
  const last = parseInt(employeeNo.slice(-1), 10);
  if (isNaN(last)) return "lark";
  if (last < 5) return "lark";
  if (last < 8) return "dingtalk";
  if (last === 8) return "wecom";
  return "email";
}

function buildCard(opts: {
  type: NotifType;
  campaignName: string;
  endAt: Date;
  giftNames: string[];
  employeeName: string;
}): { title: string; content: string } {
  const { type, campaignName, endAt, giftNames, employeeName } = opts;
  const meta = TYPE_META[type];
  const giftLine = giftNames.length === 1 ? giftNames[0] : `${giftNames.length} 选 1（${giftNames.join(" / ")}）`;
  const endStr = `${endAt.getMonth() + 1}/${endAt.getDate()} ${String(endAt.getHours()).padStart(2, "0")}:${String(endAt.getMinutes()).padStart(2, "0")}`;

  const titleMap: Record<NotifType, string> = {
    initial: `${meta.emoji} ${campaignName} 福利已开放`,
    reminder_24h: `${meta.emoji} 还有 24 小时，${campaignName} 即将关闭`,
    reminder_2h: `${meta.emoji} 仅剩 2 小时，${campaignName} 即将关闭`,
    last_call: `${meta.emoji} 别忘了领取你的 ${campaignName}`,
    reserved_confirm: `${meta.emoji} ${campaignName} 预约成功`,
    claimed_confirm: `${meta.emoji} 已签收：${campaignName}`,
  };

  const contentMap: Record<NotifType, string> = {
    initial: `${employeeName}，你符合本期节日福利资格，可领取「${giftLine}」。截止时间：${endStr}，请尽快前往领取。`,
    reminder_24h: `还有未领取的福利「${giftLine}」，将于 ${endStr} 关闭。点击领取，避免错过。`,
    reminder_2h: `紧急：${endStr} 即将关闭！「${giftLine}」尚未预约，逾期不可补领。`,
    last_call: `行政提醒：你的节日福利「${giftLine}」尚未领取，请尽快预约。`,
    reserved_confirm: `预约信息已就绪，请凭 6 位核销码或二维码至取货点领取。${endStr} 前未领取将自动取消。`,
    claimed_confirm: `已签收「${giftLine}」。祝节日愉快 🎉`,
  };

  return { title: titleMap[type], content: contentMap[type] };
}

// ============== 公开 API ==============

/**
 * 为活动的所有合格员工 enqueue 一批通知
 * 防重：同一 campaign+employee+type 已存在则跳过
 */
export async function enqueueCampaignNotifications(
  campaignId: string,
  type: NotifType,
  options: { onlyUnclaimed?: boolean } = {}
) {
  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
    include: { campaignGifts: { include: { gift: true } } },
  });
  if (!campaign) throw new Error("活动不存在");

  // 找出目标员工：所有 eligible（或 onlyUnclaimed 时排除已 claimed）
  const eligibilities = await prisma.eligibility.findMany({
    where: {
      campaignId,
      status: options.onlyUnclaimed ? "eligible" : { in: ["eligible", "claimed"] },
    },
    include: { employee: true },
  });

  // 防重：拉出已存在的
  const existing = await prisma.notification.findMany({
    where: { campaignId, type, employeeId: { in: eligibilities.map((e) => e.employeeId) } },
    select: { employeeId: true },
  });
  const existingSet = new Set(existing.map((e) => e.employeeId));
  const targets = eligibilities.filter((e) => !existingSet.has(e.employeeId));

  if (targets.length === 0) return { enqueued: 0, skipped: existing.length, totalTargets: eligibilities.length };

  const giftNames = campaign.campaignGifts.map((cg) => cg.gift.name);
  const ctaUrl = `/m/claim/${campaignId}`;

  await prisma.notification.createMany({
    data: targets.map((e) => {
      const card = buildCard({
        type,
        campaignName: campaign.name,
        endAt: campaign.endAt,
        giftNames,
        employeeName: e.employee.name,
      });
      return {
        campaignId,
        employeeId: e.employeeId,
        type,
        channel: pickChannel(e.employee.employeeNo),
        title: card.title,
        content: card.content,
        ctaUrl,
      };
    }),
  });

  return { enqueued: targets.length, skipped: existing.length, totalTargets: eligibilities.length };
}

/**
 * 单个员工通知（预约/核销 确认场景）
 */
export async function enqueueEmployeeNotification(
  campaignId: string,
  employeeId: string,
  type: NotifType
) {
  const [campaign, employee] = await Promise.all([
    prisma.campaign.findUnique({
      where: { id: campaignId },
      include: { campaignGifts: { include: { gift: true } } },
    }),
    prisma.employee.findUnique({ where: { id: employeeId } }),
  ]);
  if (!campaign || !employee) return null;

  const giftNames = campaign.campaignGifts.map((cg) => cg.gift.name);
  const card = buildCard({
    type,
    campaignName: campaign.name,
    endAt: campaign.endAt,
    giftNames,
    employeeName: employee.name,
  });

  return prisma.notification.create({
    data: {
      campaignId,
      employeeId,
      type,
      channel: pickChannel(employee.employeeNo),
      title: card.title,
      content: card.content,
      ctaUrl: `/m/claim/${campaignId}`,
    },
  });
}

/**
 * 模拟"发送"：把 queued 的批量标为 sent。
 * 真实环境会调用飞书 API；这里只是 1% 模拟失败、99% 立即 sent
 */
export async function flushQueued(): Promise<{ sent: number; failed: number }> {
  const queued = await prisma.notification.findMany({
    where: { status: "queued" },
    select: { id: true },
  });

  let sent = 0;
  let failed = 0;
  const now = new Date();

  for (const n of queued) {
    // mock：随机 1% 失败
    if (Math.random() < 0.01) {
      await prisma.notification.update({
        where: { id: n.id },
        data: { status: "failed", failReason: "IM 服务超时（mock）" },
      });
      failed++;
    } else {
      await prisma.notification.update({
        where: { id: n.id },
        data: { status: "sent", sentAt: now },
      });
      sent++;
    }
  }
  return { sent, failed };
}

/**
 * 自动催领：找出所有进行中的活动，按截止时间窗口 enqueue 催领
 * - 截止前 24h ± 1h 窗口：enqueue reminder_24h
 * - 截止前 2h ± 30min 窗口：enqueue reminder_2h
 */
export async function autoEnqueueReminders(): Promise<{
  reminder24h: number;
  reminder2h: number;
}> {
  const now = new Date();
  const activeCampaigns = await prisma.campaign.findMany({
    where: { status: "active" },
    select: { id: true, endAt: true },
  });

  let r24 = 0;
  let r2 = 0;
  for (const c of activeCampaigns) {
    const hoursToEnd = (c.endAt.getTime() - now.getTime()) / (1000 * 60 * 60);
    if (hoursToEnd > 0 && hoursToEnd <= 24) {
      const result = await enqueueCampaignNotifications(c.id, "reminder_24h", { onlyUnclaimed: true });
      r24 += result.enqueued;
    }
    if (hoursToEnd > 0 && hoursToEnd <= 2) {
      const result = await enqueueCampaignNotifications(c.id, "reminder_2h", { onlyUnclaimed: true });
      r2 += result.enqueued;
    }
  }
  return { reminder24h: r24, reminder2h: r2 };
}

export const NotifMeta = { CHANNEL_LABEL, TYPE_META };

export const TYPE_LABEL: Record<NotifType, string> = {
  initial: "活动开始",
  reminder_24h: "24h 催领",
  reminder_2h: "2h 催领",
  last_call: "手动催领",
  reserved_confirm: "预约确认",
  claimed_confirm: "领取确认",
};
