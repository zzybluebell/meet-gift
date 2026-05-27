# CLAUDE.md

给在此项目工作的 Claude 用的速查。**先看完再改代码**。

---

## 项目本质（一句话）

**礼达**：3000 人规模多楼宇公司的节日福利发放系统。三端协同：行政（PC）+ 员工（H5）+ 分仓核销员（H5）。

Vercel 部署到 `meet-gift.vercel.app`（master 分支自动部署）。生产 DB 用 **Turso** libsql，本地用 **SQLite** 文件。

---

## 三端 + 角色

| 端 | 路由 | 谁用 | 设备 |
|---|---|---|---|
| 行政管理 | `/admin/**` | role=`admin` | 💻 桌面 |
| 员工领取 | `/m/**` | role=`employee` | 📱 手机 |
| 分仓核销 | `/verify/**` | role=`verifier` | 📱 手机（仅本楼宇） |

登录 `/login`，工号即密码（mock）。`requireRole(["admin"])` 在 API 路由里强制角色。

**路径命名约定**（不要轻易改）：
- `/m` = mobile，员工 H5 端。沿用中文互联网"`m.` 子域"惯例（淘宝/京东/知乎都这样）。短、地址栏友好、扫码二维码生成的 URL 更短。**不要改成 `/mobile` 或 `/employee`** — 前者太强调设备、后者把角色暴露在 URL 里。
- `/admin` / `/verify` 用全名因为是电脑端 + 动作明确。三端命名风格不统一是有意的：m 端按设备命名（手机扫码主导）、admin/verify 按角色/动作命名。

---

## 关键数据模型（看 `prisma/schema.prisma` 全貌）

```
Building 1─N Warehouse 1─N Inventory N─1 Gift
                              ↑（qtyTotal / qtyReserved / qtyClaimed）
Building 1─N Employee
Employee N─N Campaign (通过 Eligibility)
Employee 1─N Claim N─1 Campaign + Gift + Warehouse
Campaign N─N Gift (通过 CampaignGift)
Campaign 1─N Notification N─1 Employee
```

**库存软锁定模型**：可领数 = `qtyTotal - qtyReserved - qtyClaimed`。预约只锁不扣，核销才真扣。改库存数量的 API 在 `/api/inventory`，会校验 `qtyTotal >= qtyReserved + qtyClaimed`。

**库存的所有 +1 都用 SQL 原子扣减**（[claims POST](src/app/api/claims/route.ts) / [manual-claim](src/app/api/campaigns/[id]/manual-claim/route.ts)）：

```ts
const upd = await tx.$executeRaw`
  UPDATE Inventory SET qtyReserved = qtyReserved + 1
  WHERE warehouseId = ${warehouseId} AND giftId = ${giftId}
    AND qtyTotal > qtyReserved + qtyClaimed
`;
if (upd === 0) throw new Error("缺货");
```

**别改回 `findUnique + 业务层校验 + update`**。WHERE 子句里把校验和写入合并是防超卖的关键，未来迁 Postgres 也安全。

**资格规则 DSL** (`Campaign.eligibilityRule` 是 JSON 字符串)：单层 `AND/OR` + 6 个字段（`department`、`gender`、`buildingId`、`hasChildren`、`tenureYears`、`tenureDays`）。引擎在 [src/lib/eligibility.ts](src/lib/eligibility.ts)。

---

## 🛡️ 并发安全（已实现，改时别破坏）

3000 人节日开抢场景下做了 4 层兜底。**理论上 1000+ QPS 不会超卖**。

### L1 限流（[src/lib/rate-limit.ts](src/lib/rate-limit.ts)）

| 接口 | 限流器 | 阈值 | Key |
|---|---|---|---|
| `POST /api/claims` | `claimLimiter` | 10s 5 次 | `user.id` |
| `POST /api/verify` | `verifyLimiter` | 10s 30 次 | `user.id` |
| `POST /api/auth/login` | `loginLimiter` | 60s 10 次 | `getClientIp(req)`（防工号枚举） |

**调用模式**（所有限流接口统一）：

```ts
const rl = await claimLimiter.check(user.id);
const limited = rateLimitResponse(rl);
if (limited) return limited;  // 直接 return 429 响应
```

限流必须**在业务校验之前**做，否则恶意请求会先打 DB。

当前是**内存版滑动窗口**（单 Vercel function instance 内强一致）。要严格分布式限流时换 `@upstash/ratelimit` + Upstash Redis：替换 `InMemoryStore` 实现 `RateLimitStore` 接口即可，调用方一行不用改。

### L2 SQL 原子扣减

库存 +1/-1 全部走 `$executeRaw` conditional UPDATE，WHERE 子句里包含校验。已在数据模型 section 给了例子。**别改回 read-then-write**。

### L3/L4 数据库兜底

- SQLite/Turso 写串行化（单写者）
- `@@unique([campaignId, employeeId])` 防同员工领多份

### 通知异步化（`after()`）

预约 / 核销成功后的通知**不要 await**，用 Next.js 15 `after()`：

```ts
import { NextResponse, after } from "next/server";

// tx 提交后
after(async () => {
  try {
    await enqueueEmployeeNotification(campaignId, user.id, "reserved_confirm");
    await flushQueued();
  } catch (e) {
    console.error("通知发送失败:", e);
  }
});

return NextResponse.json({ ok: true, ... });
```

`after()` 在 response 发送后才执行，Vercel function 会保持活跃到 callback 完成。**别改回 `await enqueue...`**，会把飞书/邮件 RPC 延迟塞到用户 RT 里。

### tx 内 / tx 外的规则

| 操作 | 放哪 |
|---|---|
| 库存原子扣减（SQL UPDATE） | tx 内 |
| Claim / Eligibility 状态变更 | tx 内 |
| 资格 / 活动状态 / 重复领取的预校验（findUnique） | tx 外（快读，失败早退） |
| 通知 enqueue + flush | `after()` 异步，**不在 tx 内**（外部 RPC 不能拖累 DB tx） |
| 拉日志、写 audit | tx 外 |

---

## 🚨 本地开发踩过的坑（必读）

### 1. 数据库路径双轨

- `.env` 写 `DATABASE_URL="file:./dev.db"`，libsql runtime 按 CWD 解析 → next dev 起在项目根，看的是**根目录** `dev.db`
- prisma CLI / `tsx prisma/seed.ts` 按 schema 位置解析 → `prisma/dev.db`
- 两边可能不同步。修法：`cp prisma/dev.db dev.db` 同步
- 如果 next dev 报 `no such table: main.Employee`，先 `ls -la dev.db prisma/dev.db` 看大小是否一致

### 2. SQLite/libsql 默认不开外键约束

**已修**（[src/lib/prisma.ts](src/lib/prisma.ts) 启动时 `PRAGMA foreign_keys = ON`），但要记得这条对 **Turso 生产同样有效**。`onDelete: Cascade` 全靠这个。

### 3. Node 25 + Tailwind config 不兼容

[tailwind.config.ts](tailwind.config.ts) 必须用 ESM `import` 而非 `require()`（已修）。不要再换回 `require`。

### 4. Claude Preview tool 在这台机不能用

`preview_start` 会撞 Node 25 sandbox 的 `uv_cwd EPERM`（进程启动期就崩，npm/npx/直接 node 都一样）。**直接跳过**，用 `./node_modules/.bin/next dev -p 3001` + curl/grep 验证。

### 5. `.env.example` 被某个工具自动注入真 Turso token

每次 commit 前必查：
```bash
grep -q "eyJ" .env.example && echo "⚠️ TOKEN 泄漏" || echo "✓ 干净"
```
如果含 token：`git checkout .env.example` 还原后再 commit。**绝对不能 push 含 token 的版本**。

### 6. 改了 dev.db 后必须重启 dev server

libsql connection 把 schema/data 缓存在内存。`cp` 覆盖 db 文件或外部 `sqlite3 INSERT` 后，已经 running 的 dev server **看不到新数据**（仍报"no such table"或读到旧值）。**重启 dev server**。

---

## 命令

```bash
npm run dev              # 启 dev server（默认 3000，本地常用 -p 3001 避撞）
npm run build            # prisma generate + next build（Vercel 也跑这个）
npm run db:reset         # ⚠️ 删 dev.db 重建 + 跑 seed（清所有数据！）
npm run db:seed          # ⚠️ 跑 seed（内含 deleteMany，会清现有数据！）
npm run db:studio        # Prisma Studio 可视化
npx tsc --noEmit         # 类型检查
```

**绝对不要在生产环境跑 `db:seed` 或 `db:reset`** — `prisma/seed.ts` 第 34-42 行有 `deleteMany` 清表。生产改数据走 UI 或手动 SQL。

---

## 文件地图（改什么去哪）

```
src/
├── app/
│   ├── layout.tsx              全局 metadata + body 包装
│   ├── icon.svg                favicon（Next 15 约定自动注入）
│   ├── page.tsx                / 入口（角色卡 + 设备提示徽章）
│   ├── login/                  工号登录
│   ├── admin/                  行政端（PC）
│   │   ├── layout.tsx          sidebar + main + Copyright
│   │   ├── page.tsx            看板
│   │   ├── campaigns/          活动 CRUD（节日联动日期在 new/form.tsx）
│   │   ├── gifts/              礼物 SKU 卡片墙
│   │   ├── inventory/          库存矩阵
│   │   ├── employees/          员工分页+搜索+筛选
│   │   ├── notifications/      推送中心
│   │   └── buildings/          楼宇分仓
│   ├── m/                      员工端（H5，max-w-md）
│   ├── verify/                 核销端（H5）
│   └── api/
│       ├── auth/               login/logout/me（cookie session）⚡限流 60s/10/IP
│       ├── campaigns/          活动 CRUD + eligibility/import/manual-claim（含原子扣减）
│       ├── employees/          单员工 CRUD + import（批量 xlsx）
│       ├── gifts/              礼物 CRUD（POST 含初始库存事务）
│       ├── inventory/          按 SKU×Warehouse 改总量
│       ├── claims/             预约/取消 ⚡限流 10s/5/用户 + SQL 原子扣减
│       ├── verify/             核销（扫码/输码）⚡限流 10s/30/verifier
│       ├── notifications/      消息已读/点击
│       └── cron/               expire / notifications（外部触发）
├── components/
│   ├── ui/                     shadcn-style 原子组件（badge/button/card/dialog/...）
│   ├── admin/                  行政端组件（dialog + filters + page-header + sidebar）
│   ├── mobile/                 手机端 header
│   └── copyright.tsx           全局署名 footer
├── lib/
│   ├── prisma.ts               ⚠️ libsql FK PRAGMA 在这里启用
│   ├── auth.ts                 requireRole / getCurrentUser
│   ├── eligibility.ts          规则引擎 evalRule + describeRule
│   ├── expire.ts               自动过期
│   ├── notifications.ts        通道枚举仅 lark / email
│   ├── rate-limit.ts           滑动窗口限流（claim/verify/login 三个预设）
│   └── utils.ts                cn / 日期 / 核销码生成
prisma/
├── schema.prisma               所有 Prisma model
├── seed.ts                     ⚠️ 含 deleteMany 清表，慎用
└── migrate-channels-to-lark-email.sql  历史数据迁移用
public/samples/                 员工/资格名单导入 xlsx 模板
samples/                        同上（开发参考用）
```

---

## Commit / Push 约定

- **不带** `Co-Authored-By: Claude` 署名（用户明确要求）
- `git add` 显式列文件，**不用** `git add .` 或 `-A`（避免 hook 改的 .env.example 被一起带进）
- commit message 中文 + conventional 前缀（`feat:` / `fix:` / `chore:`）
- **push 前必做**：
  1. `grep -q "eyJ" .env.example`（不能含真 token）
  2. `npx tsc --noEmit`
  3. 至少 curl 跑下关键路径（dev server 在 3001）
- 用户没明确说 push 就别 push

---

## 通知渠道

只保留 **lark（飞书）+ email** 两个。`dingtalk` / `wecom` 已从代码移除，但 DB 历史数据可能还有 — 跑 [prisma/migrate-channels-to-lark-email.sql](prisma/migrate-channels-to-lark-email.sql) 清。前端 fallback 已显示飞书，不会崩。

---

## 添加新礼物 / 员工 的"正确路径"

**新礼物**：通过 `/admin/gifts` → `+ 新增礼物` Dialog（含按分仓初始库存）。**不再走 SQL/seed**。

**批量员工**：`/admin/employees` → `批量导入` 上传 xlsx（模板在 `/samples/employees-import-sample.xlsx`）。三种冲突模式：`strict` / `skip`（默认）/ `overwrite`。

---

## 节日联动日期 — 维护提醒

[src/app/admin/campaigns/new/form.tsx](src/app/admin/campaigns/new/form.tsx) 的 `LUNAR_HOLIDAY_DATES` 硬编码到 **2028**。2029 起需要补表，否则春节/端午/中秋按钮点击后 hint 消失但不报错（用户看不出来日期没自动填）。

---

## 已知风险（短期内不优先修）

- **expire cron 大事务**：[src/lib/expire.ts](src/lib/expire.ts) 在单 tx 内 loop 处理所有过期 claims，500+ 积压时单 tx 会锁库几十秒。修法：分批，每 50 条一个 tx
- **Eligibility 取消时不回滚**：[claims/[id] DELETE](src/app/api/claims/[id]/route.ts) 只回滚 Claim+Inventory，Eligibility 没改。当前流程下不可见，但缺对称性，加"行政强制取消已核销"功能时会暴露
- **限流单实例内存**：Vercel 多 function instance 下不严格分布式，要严格的话装 `@upstash/ratelimit` 换 store
- **`getCurrentUser` 不缓存**：每次 API 都查一次 Employee，3k 人活跃时 DB 读压力翻倍
- 礼物 DELETE 有 TOCTOU 竞态（admin-only，影响小）
- gift-dialog 估值 JS 浮点：12.345 元会丢 5 分
- 礼物估值无业务上限
- xlsx 包让 import lambda 冷启动 +200-400ms
- 员工 filter useEffect 不响应浏览器 back/forward 时的外部 URL 变化
- `distinct department` 是全表扫，10k+ 员工时建议加 Department 表
- eligibilityRule 接受任意嵌套深度（admin-only）
