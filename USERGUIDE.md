# 礼达 · 用户使用手册 / User Guide

> 节日福利礼物发放系统 · Holiday Gift Distribution System
>
> 版本 v0.3 · 2026-05

> 中文版在前，English version follows.

---

# 🇨🇳 中文用户手册

## 📖 目录

1. [产品概览](#1-产品概览)
2. [快速开始](#2-快速开始)
3. [Demo 账号](#3-demo-账号)
4. [行政管理端](#4-行政管理端)
5. [员工领取端](#5-员工领取端)
6. [分仓核销端](#6-分仓核销端)
7. [关键业务场景](#7-关键业务场景)
8. [常见问题 FAQ](#8-常见问题-faq)
9. [技术架构参考](#9-技术架构参考)

---

## 1. 产品概览

### 1.1 产品定位

**礼达**是一套面向**3000 人规模、多楼宇分布**的中大型公司的节日福利发放系统。它取代了"行政部门用 Excel + 微信群 + 表单"的原始流程，提供：

- 📋 **行政高效管理**：活动配置、库存盘点、分仓调度、自动催领
- 🎁 **员工自助领取**：IM 推送 → 一键预约 → 楼内自取
- 🔍 **核销可追溯**：二维码 / 工号双通道核销，一码一用

### 1.2 适用场景

| 节日 | 福利类型 |
|---|---|
| 春节 | 春节礼盒、年货 |
| 端午 | 粽子、咸鸭蛋 |
| 中秋 | 月饼礼盒（多 SKU 二选一） |
| 三八妇女节 | 鲜花 / 化妆品（仅女员工） |
| 六一儿童节 | 玩具 / 童书（仅有娃员工） |
| 生日 | 蛋糕券、礼品卡 |
| 司庆 / 入职周年 | 纪念品（按司龄） |

### 1.3 核心价值

| 角色 | 痛点 | 礼达解法 |
|---|---|---|
| 行政 | Excel 名单错乱、库存对不上、催领靠群发 | 规则引擎自动算资格 + 软锁定库存 + IM 自动催领 |
| 员工 | 不知道有福利 / 错过领取 / 排队领 | IM 推送 + 一码一用 + 多楼宇就近自取 |
| 核销员 | 纸质名单核对慢、易领错 | 扫码 / 工号 1 秒核销 + 跨楼宇拒绝 |

---

## 2. 快速开始

### 2.1 环境要求

- **Node.js** ≥ 18.0
- **npm** ≥ 9.0
- 浏览器：Chrome / Edge / Safari 最新版

### 2.2 首次启动

```bash
# 1. 安装依赖
npm install

# 2. 初始化数据库（创建 SQLite + 表结构）
npx prisma db push --skip-generate
npx prisma generate

# 3. 灌入演示数据（100 员工 + 3 楼宇 + 7 礼物 + 3 个 demo 活动）
npx tsx prisma/seed.ts

# 4. 启动开发服务器
npm run dev
```

打开浏览器访问 **http://localhost:3000**

### 2.3 重置数据

```bash
# 清空数据库重来
rm prisma/dev.db
npx prisma db push --skip-generate
npx tsx prisma/seed.ts
```

---

## 3. Demo 账号

打开首页能看到三类角色的 demo 账号卡片，**点击账号直接登录**（无密码，MVP mock 模式）。

### 🛡️ 行政管理员（admin）

| 工号 | 姓名 | 部门 |
|---|---|---|
| `10001` | 小 A | 行政人事 |

### 🎁 普通员工（employee）

| 工号 | 姓名 | 备注（用于差异化福利） |
|---|---|---|
| `30001` | 小 B | 男 · 研发中心 · 5 年司龄 |
| `30002` | 小 D | 女 · 设计中心 · 有娃（可领女神节 + 儿童节） |
| `30003` | 小 E | 女 · 产品中心（可领女神节） |

另有 `30004` - `30100` 共 100 个员工分布在 3 个楼宇。

### 📷 分仓核销员（verifier）

| 工号 | 姓名 | 所在楼宇 | 核销范围 |
|---|---|---|---|
| `20001` | 小 C1 | 科技园 A 座 | **仅本楼** |
| `20002` | 小 C2 | 科技园 B 座 | **仅本楼** |
| `20003` | 小 C3 | 海岸城写字楼 | **仅本楼** |

> ⚠️ 跨楼宇核销会被拒绝并提示"请到 XX 座 核销"

---

## 4. 行政管理端

登录 `10001` 进入 `/admin`。左侧 7 个一级菜单。

### 4.1 看板 `/admin`

首页 4 个核心指标 + 进行中活动列表 + 低库存预警：

- **总员工** · **进行中活动** · **本月发放数** · **库存预警**
- 每个活动显示：覆盖人数 / 已领取 / 进度条
- 库存预警：available < 20% 红色提示

**右上角操作**：
- `运行过期检查`：手动触发 `/api/cron/expire`，清理过期预约和资格
- `+ 创建活动`：跳到创建活动流程

### 4.2 活动批次 `/admin/campaigns`

#### 4.2.1 创建活动

`/admin/campaigns/new` 四步表单：

1. **基本信息**：名称、节日类型、起止时间、描述
2. **选择礼物**：从 SKU 库选 1 个（固定）或多个（员工二选一）
3. **资格规则**：可视化构建器，单层 AND/OR：
   - 全员 ALL
   - 性别 = 男/女
   - 司龄 ≥ N 年
   - 有娃 = true
   - 部门 ∈ 集合
   - 楼宇 ∈ 集合
4. **预览生效**：实时显示"符合 X 人"，确认无误后保存

> 💡 创建后默认 `draft`，需要手动改为 `active` 才会触发员工通知。

#### 4.2.2 活动详情页 `/admin/campaigns/[id]`

右上角四个动作按钮：

| 按钮 | 说明 |
|---|---|
| **导入名单** | Excel/CSV 上传，工号匹配，覆盖或追加资格名单 |
| **补录领取** | 手动给员工补登记一笔已领（用于代领、漏发） |
| **删除** | 仅在无任何已领取记录时可用 |
| **状态切换** | draft → active → closed |

页面还包括：进度条（已领 / 资格总数）、礼物 SKU 列表、推送漏斗概览。

#### 4.2.3 状态流转

```
draft（草稿）  →  active（进行中）  →  closed（已结束）
                   ↑                       ↑
                  手动激活                  自动过期 or 手动关闭
```

激活时**自动给所有合格员工推送初次通知**（飞书 / 邮件 mock）。

### 4.3 推送中心 `/admin/notifications`

PRD §6 员工旅程的核心数据闭环。

#### 4.3.1 全局漏斗

5 个核心指标：

- **已发送**：所有 sent + read + clicked 之和
- **已查看**：read + clicked
- **已点击**：clicked
- **排队中**：queued（尚未"发送"）
- **失败**：failed（mock 1% 失败率）

#### 4.3.2 按活动漏斗

每个活动一张卡片，4 行漏斗条：

```
触达 100/100 (100%)  ━━━━━━━━━━━━━━━━━━━━━━━━━━ 蓝色
查看  38/100  (38%)  ━━━━━━━━━━ 绿色
点击  28/100  (28%)  ━━━━━━━ 紫色
领取  19/100  (19%)  ━━━━━ 红色（高亮）
```

#### 4.3.3 手动催领

每张活动卡有两个按钮：

- **重推初次通知**：给所有合格员工再推一次（防重逻辑会跳过已推送的）
- **手动催领未领者**：只给状态 = eligible 的人推 `last_call` 类型通知

顶部还有 **跑一轮催领定时**：模拟 cron 触发，会：
1. 找所有截止前 24h 的活动 → enqueue `reminder_24h`
2. 找所有截止前 2h 的活动 → enqueue `reminder_2h`
3. 把 queued 的全部标为 sent（99%）或 failed（1%）

### 4.4 礼物 SKU `/admin/gifts`

管理礼物库：名称、品类（食品 / 日用 / 数码 / 其他）、估值（元）、过敏原标签。

> 食品类必须填过敏原标签（如 `["nuts","dairy"]`），活动配置时会向员工展示。

### 4.5 库存管理 `/admin/inventory`

矩阵视图：横轴楼宇，纵轴礼物，单元格 = `qtyAvailable / qtyTotal`。

**软锁定机制**：
```
qtyAvailable = qtyTotal − qtyReserved − qtyClaimed
```

- 员工预约时 `qtyReserved++`
- 核销时 `qtyReserved−−` && `qtyClaimed++`
- 取消/过期时 `qtyReserved−−`

直接点格子修改 `qtyTotal`。负值会被拒绝。

### 4.6 员工名单 `/admin/employees`

兼具**员工管理**和**权限管理**两个功能。

#### 4.6.1 顶部统计

- 在职人数 · 管理员数 · 核销员数 · 女员工数 · 有娃员工数
- 楼宇分布卡片

#### 4.6.2 表格

11 列：工号、姓名、部门、楼宇、司龄、性别、有娃、角色、状态、领取次数、编辑按钮

#### 4.6.3 编辑员工

点铅笔图标进入编辑弹窗，可改：

- 姓名 / 部门 / 性别 / 楼宇 / 入职日期 / 出生日期 / 有娃
- **角色**：employee / verifier / admin
- **状态**：active / leave / resigned

**防呆规则**：

| 操作 | 结果 |
|---|---|
| 改自己的角色 | ❌ 拒绝（防锁定） |
| 停用自己 | ❌ 拒绝 |
| 把最后一个在职 admin 降级 | ❌ `至少保留 1 个在职管理员` |
| 把人设为 verifier 但没指定楼宇 | ❌ `核销员必须先分配楼宇` |
| 删除有领取记录的员工 | ✅ 软删（status=resigned） |
| 删除全新员工 | ✅ 硬删 |

#### 4.6.4 添加员工

顶部"添加员工"按钮。新员工默认角色 `employee`、状态 `active`、楼宇可选。

### 4.7 楼宇分仓 `/admin/buildings`

每栋楼对应一个 Warehouse（一对一）。展示：

- 楼宇名 / 地址
- 该楼宇员工数
- 该楼宇库存总览（已分配 / 已锁定 / 可用）
- 核销员名单

---

## 5. 员工领取端

登录 `30001` 进入 `/m`（手机宽度，最大 448px）。

### 5.1 顶部导航

- 左：礼达 logo + 链接首页
- 右：🔔 消息中心（带未读红点）+ 用户名 + 退出

### 5.2 我的礼物 `/m`

按状态分组展示：

#### 5.2.1 待预约（status = eligible）

显示活动卡片：节日插画 + 名称 + 截止时间 + 礼物预览 + "立即领取"按钮。

#### 5.2.2 已预约待核销（status = reserved）

显示核销凭证卡：
- 大号二维码（包含 qrToken）
- 6 位数字核销码（手动输入备用）
- 礼物名 + 取货楼宇 + 截止时间
- "撤销预约"按钮

#### 5.2.3 已领取（status = claimed）

历史记录卡片，显示已领礼物 + 核销时间。

### 5.3 预约流程 `/m/claim/[campaignId]`

三步：

1. **选礼物**（多选一活动）：显示所有 SKU 卡片，点击切换
2. **选楼宇**：列出所有有库存的楼宇 + 实时余量
3. **确认**：生成核销码 + QR + 推送预约确认通知

> 💡 软锁定：第二步选完楼宇后立即 `qtyReserved++`，即使不点确认也会锁 30 秒（防并发抢库存）

### 5.4 消息中心 `/m/messages`

模拟 IM 收件箱：

- 每条消息一张大卡片
- 顶部条显示渠道图标（飞书🐦 / 邮件✉）
- 类型标签彩色（新福利 / 24h 催领 / 2h 紧急 / 行政提醒 / 预约成功 / 已签收）
- 卡片左侧节日 emoji（🥮🍡🧧🌹🎈🎂）
- 标题 + 内容 + CTA 链接
- 未读消息蓝点 + 加粗 + 边框高亮
- 点卡片 → 标记已读；点 CTA → 标记已点击 + 跳到活动页

顶部"全部已读"按钮。

---

## 6. 分仓核销端

登录 `20001`/`20002`/`20003` 进入 `/verify`。

### 6.1 两种核销方式

#### 6.1.1 扫描二维码

打开摄像头扫员工出示的 QR。识别后**自动核销**（无需手动确认）。

#### 6.1.2 输入工号

员工没法显示二维码时（手机没电、APP 闪退）的兜底：

1. 员工告知 6 位核销码（如 `483921`）
2. 核销员在 `/verify` 输入框输入 → 回车
3. 1 秒内显示员工姓名 + 礼物名 + ✅ 核销成功

### 6.2 三种异常提示

| 情况 | 提示 | 颜色 |
|---|---|---|
| 跨楼宇 | `请到 科技园 A 座 核销` | 黄色警告 |
| 已核销过 | `已于 2026-05-25 14:32 核销过` + 详情 | 红色 |
| 已过期 | `该预约已过期` | 灰色 |

异常态都会显示员工姓名、礼物、活动名以便辨识。

### 6.3 顶部今日数据

- 我已核销 / 本楼总核销 / 库存余量

---

## 7. 关键业务场景

### 7.1 Excel 名单导入

**场景**：HR 系统延迟，行政想手动覆盖某活动的资格名单。

1. 进活动详情页 → "导入名单"
2. 选择模式：
   - **追加**：保留现有名单，仅新增上传的工号
   - **替换**：清空原名单，按上传的重建
3. 上传 `.xlsx` / `.xls` / `.csv`，首列或标题为"工号"
4. 提示：
   - 读取 X 行 / 匹配 Y 人 / 新增 Z 条
   - 未找到的工号会列出（最多 20 个）

### 7.2 补录领取

**场景**：员工因故没法亲自来（出差、休假），行政代为登记已领；或者纸质流程已领但系统漏了。

1. 进活动详情页 → "补录领取"
2. 输入工号 → 选择礼物（多选一时）→ 选择楼宇（默认 = 员工所在楼）
3. 点"确认补录"
4. 系统会：
   - 直接创建 claim 状态 = `claimed`
   - 库存 `qtyClaimed++`
   - 资格状态 → `claimed`
   - 跳过 reserved 中间态

### 7.3 自动过期

**场景**：截止时间到了，需要回收未领取的库存。

**触发方式**：

1. 手动：Dashboard 右上 `运行过期检查` 按钮
2. API：`POST /api/cron/expire`（接 Vercel Cron 或外部定时器）

**处理逻辑**（三步级联）：

```
1. endAt < now 的 active 活动 → 标记 closed
2. 状态 reserved + 活动已 closed（或截止 + 24h 宽限期已过）
   → 标记 expired + qtyReserved-- 释放库存
3. 状态 eligible + 活动已 closed → 标记 expired（资格清算）
```

> 24h 宽限期：截止后还允许已预约者补到，避免末班车员工被误杀。

### 7.4 自动通知触达

5 个时机自动触发 + 1 个手动：

| 时机 | 类型 | 触发方 |
|---|---|---|
| 活动从 draft 变 active | `initial` | 自动 |
| 截止前 24h | `reminder_24h` | cron |
| 截止前 2h | `reminder_2h` | cron |
| 行政手动催 | `last_call` | 推送中心按钮 |
| 员工预约成功 | `reserved_confirm` | 自动 |
| 员工核销成功 | `claimed_confirm` | 自动 |

**防重逻辑**：同一 `campaign + employee + type` 已存在则跳过，避免轰炸。

### 7.5 跨楼宇核销拒绝

代码位置：`src/app/api/verify/route.ts:54-71`

```ts
if (user.role === "verifier" && user.buildingId !== claim.warehouse.buildingId) {
  return NextResponse.json({
    error: `请到 ${claim.warehouse.building.name} 核销`,
  }, { status: 400 });
}
```

测试方法：
1. 用 `30001`（科技园 A 座员工）预约 → 拿到核销码
2. 用 `20002`（科技园 B 座核销员）登录 → 输入码
3. 应报错 `请到 科技园 A 座 核销`

---

## 8. 常见问题 FAQ

### Q1: 改了员工角色但本人没生效？

A: 角色变更在**下次登录**或**当前 Session 过期**后生效。让员工退出重登即可。

### Q2: 自动过期后能反悔吗？

A: 可以，但需要手动恢复：
1. 把活动 status 改回 `active`，延长 endAt
2. 用"补录领取"重新给员工建一笔 claim

### Q3: 库存为 0 还能预约吗？

A: 不能。预约接口会校验 `(qtyTotal - qtyReserved - qtyClaimed) > 0`，否则返回 `该楼宇已缺货，请选其他楼宇`。

### Q4: 员工撤销预约后库存会释放吗？

A: 会。撤销 = `qtyReserved--`，立即释放给其他员工。

### Q5: 一个员工能领多份吗？

A: 数据库唯一约束 `@@unique([campaignId, employeeId])` 强制一份。如果之前 cancelled / expired，员工可以重新预约（会覆盖原 claim）。

### Q6: 真实环境怎么接飞书 / 邮件？

A: 把 `src/lib/notifications.ts` 的 `flushQueued()` 函数里的 mock "成功/失败"逻辑替换成真实的飞书 Open API / SMTP 调用。表结构、UI、漏斗都不用动。

### Q7: 如何让某个活动只对某个楼宇可见？

A: 在创建活动时，资格规则选 "AND" → 加一条 "楼宇 IN [选中的楼宇]"。

### Q8: 离职员工的预约会自动取消吗？

A: 当前 MVP **不会**。需要手动改员工状态为 `resigned`，再跑一次"过期检查"。生产版本会加级联取消逻辑。

---

## 9. 技术架构参考

### 9.1 技术栈

- **前端**：Next.js 15 App Router + React 19 + Tailwind CSS + Lucide Icons
- **后端**：Next.js Route Handlers
- **数据库**：SQLite (dev) / Postgres (prod) via Prisma
- **认证**：Cookie session (mock)
- **二维码**：`qrcode` 生成 + `html5-qrcode` 扫描
- **Excel**：`xlsx` 库

### 9.2 数据模型（核心 8 表）

```
Employee   ─┬─ Claim ───┬─ Campaign ──┬─ CampaignGift ─── Gift
            │           │              │
            └─ Eligibility─┘             └─ Notification
                                        
Building ── Warehouse ── Inventory ───── Gift
```

- **Eligibility**：资格名单（活动 × 员工，状态 eligible/excluded/claimed/expired）
- **Claim**：领取记录（活动 × 员工 唯一，状态 reserved/claimed/cancelled/expired）
- **Inventory**：分仓库存（楼宇 × 礼物 唯一，软锁定）
- **Notification**：IM 推送记录（6 种类型 × 4 种渠道）

### 9.3 关键接口

| 路径 | 方法 | 用途 |
|---|---|---|
| `/api/auth/login` | POST | 工号登录 |
| `/api/campaigns` | POST | 创建活动 |
| `/api/campaigns/[id]` | PATCH/DELETE | 改状态 / 删活动 |
| `/api/campaigns/[id]/eligibility/import` | POST | Excel 导入名单 |
| `/api/campaigns/[id]/manual-claim` | POST | 补录领取 |
| `/api/campaigns/[id]/notifications/enqueue` | POST | 推送一批通知 |
| `/api/claims` | POST | 员工预约 |
| `/api/claims/[id]` | PATCH | 员工撤销预约 |
| `/api/verify` | POST | 核销 |
| `/api/employees` | POST | 添加员工 |
| `/api/employees/[id]` | PATCH/DELETE | 改员工 / 删员工 |
| `/api/inventory` | PATCH | 改库存 |
| `/api/notifications` | GET | 我的消息列表 |
| `/api/notifications/[id]` | PATCH | 标记已读 / 已点击 |
| `/api/cron/expire` | POST | 自动过期 |
| `/api/cron/notifications` | POST | 自动催领 + 发送队列 |

### 9.4 规则引擎 DSL

`src/lib/eligibility.ts` 定义：

```ts
type Rule =
  | { type: "ALL" }
  | { type: "GENDER"; eq: "M" | "F" }
  | { type: "TENURE"; gte: number }
  | { type: "HAS_CHILDREN"; eq: boolean }
  | { type: "DEPARTMENT"; in: string[] }
  | { type: "BUILDING"; in: string[] }
  | { type: "AND"; rules: Rule[] }
  | { type: "OR"; rules: Rule[] };
```

存储为 JSON 字符串在 `Campaign.eligibilityRule`。

---

---

# 🇬🇧 English User Guide

## 📖 Table of Contents

1. [Product Overview](#1-product-overview-en)
2. [Quick Start](#2-quick-start-en)
3. [Demo Accounts](#3-demo-accounts-en)
4. [Admin Portal](#4-admin-portal-en)
5. [Employee Portal](#5-employee-portal-en)
6. [Verification Portal](#6-verification-portal-en)
7. [Key Workflows](#7-key-workflows-en)
8. [FAQ](#8-faq-en)
9. [Technical Reference](#9-technical-reference-en)

---

## <a id="1-product-overview-en"></a>1. Product Overview

### 1.1 Positioning

**Lida** (礼达, "gift delivery") is a holiday-gift distribution system designed for **mid-to-large companies of ~3,000 employees** spread across **multiple office buildings in the same city**. It replaces the typical "Excel + WeChat group + Google Forms" chaos with:

- 📋 **Admin efficiency** — Campaign config, inventory, multi-warehouse routing, auto-reminders
- 🎁 **Employee self-service** — IM push → 1-tap reservation → in-building pickup
- 🔍 **Auditable verification** — QR code / employee number, one-time use, cross-building rejection

### 1.2 Target Scenarios

| Holiday | Gift Examples |
|---|---|
| Spring Festival | New Year gift boxes |
| Dragon Boat | Zongzi, salted duck eggs |
| Mid-Autumn | Mooncake box (multi-SKU, pick one) |
| Women's Day | Flowers / cosmetics (female only) |
| Children's Day | Toys / books (parents only) |
| Birthday | Cake voucher, gift card |
| Work anniversary | Tenure-based commemorative gifts |

### 1.3 Core Value

| Role | Pain | Lida Solution |
|---|---|---|
| Admin | Excel chaos, inventory drift, manual chasing | Rule engine + soft-locked inventory + IM auto-reminders |
| Employee | Doesn't know there's a gift, misses deadline, queues to pick up | IM push + one-time code + nearest pickup |
| Verifier | Slow paper-list lookup, easy to dispense wrong gift | QR / employee no. verification in 1 sec + cross-building guard |

---

## <a id="2-quick-start-en"></a>2. Quick Start

### 2.1 Requirements

- **Node.js** ≥ 18.0
- **npm** ≥ 9.0
- Browser: latest Chrome / Edge / Safari

### 2.2 First Run

```bash
# 1. Install dependencies
npm install

# 2. Initialize the database (SQLite + schema)
npx prisma db push --skip-generate
npx prisma generate

# 3. Seed demo data (100 employees + 3 buildings + 7 gifts + 3 campaigns)
npx tsx prisma/seed.ts

# 4. Start dev server
npm run dev
```

Open **http://localhost:3000** in your browser.

### 2.3 Reset Data

```bash
rm prisma/dev.db
npx prisma db push --skip-generate
npx tsx prisma/seed.ts
```

---

## <a id="3-demo-accounts-en"></a>3. Demo Accounts

The homepage shows demo accounts as cards. **Click any account to log in** (no password — MVP mock mode).

### 🛡️ Admin

| Employee No. | Name | Dept. |
|---|---|---|
| `10001` | Xiao A | HR/Admin |

### 🎁 Employees

| Employee No. | Name | Profile (for rule-based eligibility) |
|---|---|---|
| `30001` | Xiao B | Male · R&D · 5 yr tenure |
| `30002` | Xiao D | Female · Design · has children |
| `30003` | Xiao E | Female · Product |

Plus 97 more (`30004`–`30100`) distributed across 3 buildings.

### 📷 Verifiers

| Employee No. | Name | Building | Scope |
|---|---|---|---|
| `20001` | Xiao C1 | Tech Park A | **This building only** |
| `20002` | Xiao C2 | Tech Park B | **This building only** |
| `20003` | Xiao C3 | Coastline Office | **This building only** |

> ⚠️ Cross-building verification is rejected with `Please verify at <correct building>`.

---

## <a id="4-admin-portal-en"></a>4. Admin Portal

Sign in as `10001` → lands on `/admin`. Seven menu items in the sidebar.

### 4.1 Dashboard `/admin`

Top: 4 KPIs · Active campaigns · Low-stock alerts.

- **Total employees** · **Active campaigns** · **This-month claims** · **Stock warnings**
- Each campaign shows: eligible count / claimed / progress bar
- Stock warning: red flag when `available < 20%`

**Top-right actions**:
- `Run expire check` — manually triggers `/api/cron/expire`
- `+ New campaign` — start the campaign-creation wizard

### 4.2 Campaigns `/admin/campaigns`

#### 4.2.1 Create Campaign

`/admin/campaigns/new` — 4-step wizard:

1. **Basics**: name, holiday type, start/end, description
2. **Pick gifts**: select 1 SKU (fixed) or multiple (employee picks one)
3. **Eligibility rule**: visual builder, single-layer AND/OR:
   - `ALL` — everyone
   - `GENDER = M/F`
   - `TENURE >= N years`
   - `HAS_CHILDREN = true`
   - `DEPARTMENT ∈ {…}`
   - `BUILDING ∈ {…}`
4. **Preview**: live count of matching employees, save when satisfied

> 💡 New campaigns default to `draft`. Change status to `active` to trigger employee notifications.

#### 4.2.2 Campaign Detail `/admin/campaigns/[id]`

Top-right action buttons:

| Button | Description |
|---|---|
| **Import roster** | Upload Excel/CSV, match by employee no., replace or append eligibility |
| **Manual claim** | Admin records a claim on behalf of an employee |
| **Delete** | Only when no claims exist |
| **Status toggle** | draft → active → closed |

Also shows: progress bar (claimed/eligible), gift SKU list, notification funnel preview.

#### 4.2.3 State Machine

```
draft  →  active  →  closed
          ↑           ↑
        manual      auto-expire OR manual
```

Activation **automatically pushes the initial IM notification** to all eligible employees (mock Lark/Dingtalk/WeChat Work/email).

### 4.3 Notification Center `/admin/notifications`

The data-loop heart of PRD §6 (employee journey).

#### 4.3.1 Global Funnel

5 top-level metrics:

- **Sent** — `sent + read + clicked`
- **Viewed** — `read + clicked`
- **Clicked** — `clicked`
- **Queued** — not yet "sent"
- **Failed** — mock 1% failure rate

#### 4.3.2 Per-Campaign Funnel

One card per campaign, 4-row funnel bar:

```
Reach   100/100 (100%)  ━━━━━━━━━━━━━━━━━━━━━━━━━━ blue
View     38/100 (38%)   ━━━━━━━━━━ green
Click    28/100 (28%)   ━━━━━━━ purple
Claim    19/100 (19%)   ━━━━━ red (highlight)
```

#### 4.3.3 Manual Reminders

Two buttons per campaign card:

- **Re-send initial** — push again to all eligible (dedupe skips already-pushed)
- **Nudge unclaimed** — `last_call` push only to `status = eligible`

Top: **Run reminder cron** — simulates a cron tick:
1. Find campaigns within 24h of end → enqueue `reminder_24h`
2. Find campaigns within 2h of end → enqueue `reminder_2h`
3. Flush all queued → `sent` (99%) or `failed` (1%)

### 4.4 Gift SKUs `/admin/gifts`

Gift catalog: name, category (food / daily / digital / other), value (yuan), allergen tags.

> Food items must declare allergen tags (e.g. `["nuts","dairy"]`), shown to employees during selection.

### 4.5 Inventory `/admin/inventory`

Matrix view: rows = gifts, cols = warehouses, cells = `qtyAvailable / qtyTotal`.

**Soft-lock mechanics**:
```
qtyAvailable = qtyTotal − qtyReserved − qtyClaimed
```

- Reserve → `qtyReserved++`
- Verify  → `qtyReserved−−` && `qtyClaimed++`
- Cancel / expire → `qtyReserved−−`

Click a cell to edit `qtyTotal`. Negative values rejected.

### 4.6 Employees `/admin/employees`

Combined **employee management** and **role/permission control**.

#### 4.6.1 Header stats

Active count · admin count · verifier count · female count · parent count · per-building breakdown.

#### 4.6.2 Table

11 columns: no., name, dept., building, tenure, gender, has-children, role, status, claims count, edit pencil.

#### 4.6.3 Edit Employee

Click pencil → modal. Editable:

- Name, dept., gender, building, hire date, birth date, has-children
- **Role**: `employee` / `verifier` / `admin`
- **Status**: `active` / `leave` / `resigned`

**Safety guards**:

| Action | Result |
|---|---|
| Change your own role | ❌ Rejected (anti-lockout) |
| Disable yourself | ❌ Rejected |
| Demote the last active admin | ❌ `At least 1 active admin required` |
| Set verifier without building | ❌ `Verifier must have a building` |
| Delete employee with claims | ✅ Soft-delete (`status = resigned`) |
| Delete brand-new employee | ✅ Hard-delete |

#### 4.6.4 Add Employee

Top-right "Add employee". Defaults: role `employee`, status `active`, optional building.

### 4.7 Buildings `/admin/buildings`

Each building has a 1:1 Warehouse. Shows:

- Name / address
- Employee count
- Inventory overview (total / locked / available)
- Verifier list

---

## <a id="5-employee-portal-en"></a>5. Employee Portal

Log in as `30001` → `/m` (mobile-first, max-width 448px).

### 5.1 Top Bar

- Left: Lida logo + link home
- Right: 🔔 message center (unread red dot) + name + logout

### 5.2 My Gifts `/m`

Grouped by status:

#### 5.2.1 To Reserve (`status = eligible`)

Campaign card: holiday illustration + name + deadline + gift preview + "Claim now" button.

#### 5.2.2 Reserved, Awaiting Verification (`status = reserved`)

Voucher card:
- Large QR code (qrToken)
- 6-digit claim code (manual fallback)
- Gift + pickup building + deadline
- "Cancel reservation" button

#### 5.2.3 Claimed (`status = claimed`)

History card: gift + verified-at timestamp.

### 5.3 Reservation Flow `/m/claim/[campaignId]`

Three steps:

1. **Pick gift** (multi-select campaigns): all SKUs as tappable cards
2. **Pick building**: list buildings with live remaining-stock
3. **Confirm**: generate claim code + QR + push reservation-confirm notification

> 💡 Soft-lock: step 2 immediately increments `qtyReserved`, locks for 30 sec even before "confirm" (prevents race conditions during high traffic).

### 5.4 Message Center `/m/messages`

Simulated IM inbox:

- Each message = large card
- Top strip shows channel icon (Lark 🐦 / Dingtalk 📌 / WeChat Work 💼 / Email ✉)
- Type tag in color (New / 24h reminder / 2h urgent / Admin nudge / Reserved / Claimed)
- Holiday emoji on left (🥮🍡🧧🌹🎈🎂)
- Title + body + CTA
- Unread = blue dot + bold + highlighted border
- Tap card → mark as read; tap CTA → mark clicked + navigate

Top-right "Mark all read".

---

## <a id="6-verification-portal-en"></a>6. Verification Portal

Sign in as `20001`/`20002`/`20003` → `/verify`.

### 6.1 Two Modes

#### 6.1.1 QR Scan

Open camera, scan employee's QR. Recognized → **auto-verified** (no manual confirm).

#### 6.1.2 Code Entry

When QR fails (low battery, app crash):

1. Employee tells the 6-digit code (e.g. `483921`)
2. Verifier types it into the input → press Enter
3. Within 1 sec: name + gift + ✅ success

### 6.2 Three Error States

| Case | Message | Color |
|---|---|---|
| Wrong building | `Please verify at Tech Park A` | Yellow warning |
| Already verified | `Verified at 2026-05-25 14:32` + detail | Red |
| Expired | `Reservation expired` | Gray |

All error states still show employee name + gift + campaign for triage.

### 6.3 Today's Stats (top bar)

- My verifications today / this building's total / remaining stock

---

## <a id="7-key-workflows-en"></a>7. Key Workflows

### 7.1 Excel Import

**Scenario**: HR sync is delayed, admin wants to override a campaign's eligibility manually.

1. Campaign detail → "Import roster"
2. Pick mode:
   - **Append**: keep existing, add uploaded employee nos.
   - **Replace**: wipe existing, rebuild from upload
3. Upload `.xlsx` / `.xls` / `.csv`. First column or column titled "工号" / "employeeNo" is matched.
4. Result toast: X rows read / Y matched / Z added + list of unmatched employee nos. (up to 20)

### 7.2 Manual Claim

**Scenario**: employee can't come in person (travel, leave) — admin records the claim; or paper-flow handed out a gift the system missed.

1. Campaign detail → "Manual claim"
2. Type employee no. → pick gift (if multi-SKU) → pick building (defaults to employee's home building)
3. Click "Confirm"
4. System:
   - Creates a claim with `status = claimed` directly
   - `qtyClaimed++`
   - Eligibility flips to `claimed`
   - Skips the reserved intermediate state

### 7.3 Auto-Expire

**Scenario**: campaign deadline reached, free up unclaimed inventory.

**Triggers**:

1. Manual: Dashboard `Run expire check` button
2. API: `POST /api/cron/expire` (hook up Vercel Cron or external scheduler)

**Cascade** (3 steps):

```
1. active campaigns where endAt < now → closed
2. reserved claims for closed campaigns
   (or claims where endAt + 24h grace period passed)
   → expired + qtyReserved-- (release stock)
3. eligibility records for closed campaigns
   → expired (audit-trail)
```

> 24h grace period lets last-minute reservations still get picked up.

### 7.4 Auto Notifications

5 auto + 1 manual trigger:

| Trigger | Type | Source |
|---|---|---|
| Campaign moves draft → active | `initial` | Auto |
| 24h before deadline | `reminder_24h` | Cron |
| 2h before deadline | `reminder_2h` | Cron |
| Admin manual nudge | `last_call` | Notification Center button |
| Reservation success | `reserved_confirm` | Auto |
| Verification success | `claimed_confirm` | Auto |

**Dedupe**: same `campaign + employee + type` is skipped (no spam).

### 7.5 Cross-Building Rejection

Source: `src/app/api/verify/route.ts:54-71`

```ts
if (user.role === "verifier" && user.buildingId !== claim.warehouse.buildingId) {
  return NextResponse.json({
    error: `Please verify at ${claim.warehouse.building.name}`,
  }, { status: 400 });
}
```

To test:
1. As `30001` (Tech Park A employee), reserve a gift → get code
2. As `20002` (Tech Park B verifier), enter that code
3. Should fail with `Please verify at Tech Park A`

---

## <a id="8-faq-en"></a>8. FAQ

### Q1: I changed someone's role but they don't see it?

A: Role changes take effect on **next login** or session expiry. Have them log out and back in.

### Q2: Can I undo an auto-expire?

A: Yes, but manually:
1. Flip the campaign's status back to `active`, extend `endAt`
2. Use "Manual claim" to re-create the claim record

### Q3: Can employees reserve when stock = 0?

A: No. The reservation API checks `(qtyTotal - qtyReserved - qtyClaimed) > 0`. Otherwise: `out of stock, pick another building`.

### Q4: Does cancelling a reservation release stock?

A: Yes. Cancel = `qtyReserved--`, available immediately for others.

### Q5: Can an employee claim twice?

A: DB unique constraint `@@unique([campaignId, employeeId])` prevents it. If a previous claim was `cancelled` / `expired`, they can re-reserve (overwrites the old record).

### Q6: How do I hook up real Lark / Dingtalk in production?

A: Replace the mock "success/fail" logic inside `flushQueued()` in `src/lib/notifications.ts` with real IM Open API calls. Schema, UI, funnel — all stay the same.

### Q7: How do I make a campaign visible only to one building?

A: In the create-campaign wizard, use the rule builder with `AND` → add `BUILDING IN [selected]`.

### Q8: Do resigned employees' reservations auto-cancel?

A: Not in MVP. Mark them `resigned`, then run the expire-check. Production should add cascading cancellation.

---

## <a id="9-technical-reference-en"></a>9. Technical Reference

### 9.1 Stack

- **Frontend**: Next.js 15 App Router + React 19 + Tailwind CSS + Lucide Icons
- **Backend**: Next.js Route Handlers
- **DB**: SQLite (dev) / Postgres (prod) via Prisma
- **Auth**: cookie session (mock)
- **QR**: `qrcode` for generation, `html5-qrcode` for scanning
- **Excel**: `xlsx`

### 9.2 Data Model (8 core tables)

```
Employee   ─┬─ Claim ───┬─ Campaign ──┬─ CampaignGift ─── Gift
            │           │              │
            └─ Eligibility─┘             └─ Notification
                                        
Building ── Warehouse ── Inventory ───── Gift
```

- **Eligibility**: who qualifies (campaign × employee, status enum)
- **Claim**: one-per-campaign-per-employee, soft-locked
- **Inventory**: per-warehouse stock, soft-locked
- **Notification**: 6 types × 4 channels, with read/click tracking

### 9.3 Key Endpoints

| Path | Method | Use |
|---|---|---|
| `/api/auth/login` | POST | Login by employee no. |
| `/api/campaigns` | POST | Create campaign |
| `/api/campaigns/[id]` | PATCH/DELETE | Change status / delete |
| `/api/campaigns/[id]/eligibility/import` | POST | Excel import roster |
| `/api/campaigns/[id]/manual-claim` | POST | Admin manual claim |
| `/api/campaigns/[id]/notifications/enqueue` | POST | Push a batch |
| `/api/claims` | POST | Employee reserve |
| `/api/claims/[id]` | PATCH | Employee cancel |
| `/api/verify` | POST | Verifier verify |
| `/api/employees` | POST | Add employee |
| `/api/employees/[id]` | PATCH/DELETE | Edit / delete |
| `/api/inventory` | PATCH | Update stock |
| `/api/notifications` | GET | My inbox |
| `/api/notifications/[id]` | PATCH | Mark read / clicked |
| `/api/cron/expire` | POST | Auto-expire job |
| `/api/cron/notifications` | POST | Auto-reminders + flush queue |

### 9.4 Rule Engine DSL

Defined in `src/lib/eligibility.ts`:

```ts
type Rule =
  | { type: "ALL" }
  | { type: "GENDER"; eq: "M" | "F" }
  | { type: "TENURE"; gte: number }
  | { type: "HAS_CHILDREN"; eq: boolean }
  | { type: "DEPARTMENT"; in: string[] }
  | { type: "BUILDING"; in: string[] }
  | { type: "AND"; rules: Rule[] }
  | { type: "OR"; rules: Rule[] };
```

Stored as a JSON string in `Campaign.eligibilityRule`.

---

## 📝 Changelog

- **v0.3** (2026-05) — IM push mock, notification center, employee message inbox
- **v0.2** (2026-05) — Excel import, manual claim, auto-expire, role management
- **v0.1** (2026-05) — Initial MVP: 3 portals, campaigns, claims, verification

## 📄 License

Internal demo project. PRD reference: `PRD-节日福利礼物发放系统.md`.
