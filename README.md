# 礼达 · 节日福利发放系统

> 为 3000 人规模的多楼宇公司提供节日礼物发放 × 员工自助领取 × 行政高效管理的一体化系统。

---

## ✨ 覆盖场景

- ✅ **S1 全员同款发放**（中秋月饼，人手一份）
- ✅ **S2 多 SKU 自选**（端午粽子礼盒 A/B/C 选一）
- ✅ **S3 差异化人群**（女神节限女员工、儿童节限有娃员工）

三端齐全：

| 端 | 路由 | 主要功能 |
|---|---|---|
| 行政管理端 | `/admin` | 看板、活动 CRUD、库存矩阵、员工、楼宇 |
| 员工移动端网页 | `/m` | 我的福利、选择礼物 + 楼宇、生成核销码 |
| 分仓核销端 | `/verify` | 扫码 / 6位码核销、库存、待核销名单 |

---

## 🚀 快速开始

```bash
# 安装
npm install

# 插入数据库连接
echo "DATABASE_URL=\"file:$(pwd)/dev.db\"" > .env

# 初始化数据库 + 种子数据
npm run db:reset

# 启动开发服务器
npm run dev

#前往本地连接
# → http://localhost:3000
```

### 💡 Demo 账号（工号登录，无需密码）

| 角色 | 工号 | 名称 |
|---|---|---|
| 行政管理员 | `10001` | 小 A |
| 分仓核销员 | `20001` / `20002` / `20003` | 三个楼宇的小 C |
| 普通员工 | `30001` / `30002` / `30003` | 不同部门员工 |
| 随机员工 | `4xxxx` | 100 人池 |

---

## 🎬 完整 Demo 流程（5 分钟体验）

1. **行政端**（工号 `10001`）
   - 进 `/admin`，看到看板有"2026 中秋福利"进行中
   - 进 `/admin/campaigns/new` 创建新活动 → 选节日、选礼物、选资格人群
   - 进 `/admin/inventory` 点单元格改库存

2. **员工端**（换号 `30002`）
   - 进 `/m` 看到女神节福利（仅女员工可见）
   - 进活动 → 选礼物 + 楼宇 → 生成二维码 + 6 位核销码

3. **核销端**（换号 `20002`，对应小 D 所在的科技园 B 座）
   - 进 `/verify`，输入 30002 刚生成的 6 位码 → 核销成功
   - 库存自动 `reserved -1` & `claimed +1`

4. **回到行政端** 看看板/活动详情 → 实时同步

---

## 🧠 关键设计决策

| 决策 | 选择 | 原因 |
|---|---|---|
| 员工端形态 | 移动端网页 | 公司 SSO 静默授权最快，IM 一点即开 |
| 核销码 | 6 位数字 + QR token | 一码一用、可离线缓存、绑定 claimId |
| 库存模型 | 全局共享 + 软锁定 reserved | 同 SKU 可跨批次复用，预约/核销区分 |
| 规则引擎 | 6 个预设 + 单层 AND/OR | "不能比 Excel 还难用" |
| 代领功能 | 暂不支持 | 复杂度爆炸，<3% 场景 |

---

## 🗂️ 数据模型（Prisma + SQLite）

```
Employee ─┬─ buildingId → Building ── warehouses → Warehouse
          │                                          │
          └─ claims → Claim ──────────────────── ┘
                            │
                            ├─ campaignId → Campaign ── campaignGifts → Gift
                            ├─ giftId → Gift
                            └─ warehouseId → Warehouse ── inventories → Inventory
                                                            (qtyTotal / qtyReserved / qtyClaimed)

Campaign ── eligibilities → Eligibility (campaignId + employeeId, status)
```

资格规则 DSL（`Campaign.eligibilityRule`，JSON 字符串）：

```json
{ "type": "ALL" }
{ "type": "AND", "rules": [{ "field": "gender", "op": "=", "value": "F" }] }
{ "type": "AND", "rules": [{ "field": "tenureYears", "op": ">=", "value": 3 }] }
{ "type": "AND", "rules": [{ "field": "department", "op": "in", "value": ["研发中心","设计中心"] }] }
```

实现见 [src/lib/eligibility.ts](./src/lib/eligibility.ts)。

---

## 🗂️ 项目结构

```
src/
├── app/
│   ├── page.tsx                  入口（角色选择）
│   ├── login/                    工号登录
│   ├── admin/                    行政端（PC 布局）
│   │   ├── page.tsx              看板
│   │   ├── campaigns/            活动 CRUD
│   │   ├── inventory/            库存矩阵编辑器
│   │   ├── employees/            员工名单
│   │   ├── buildings/            楼宇分仓
│   │   └── gifts/                礼物 SKU
│   ├── m/                        员工端（移动端网页）
│   │   ├── page.tsx              我的福利
│   │   └── claim/[campaignId]/   预约 + 核销码
│   ├── verify/                   核销端（移动端网页）
│   │   └── page.tsx              扫码 / 输码 / 库存 / 待核销
│   └── api/
│       ├── auth/                 login / logout / me
│       ├── campaigns/            活动 CRUD
│       ├── claims/               预约 / 取消
│       ├── inventory/            库存调整
│       └── verify/               核销
├── components/
│   ├── ui/                       shadcn-style 原子组件
│   ├── admin/                    行政端组件
│   └── mobile/                   移动端组件
├── lib/
│   ├── prisma.ts                 Prisma client 单例
│   ├── auth.ts                   cookie-based mock session
│   ├── eligibility.ts            资格规则引擎
│   ├── expire.ts                 过期/释放逻辑（cron 调用）
│   ├── notifications.ts          IM 推送 enqueue / flush
│   ├── rate-limit.ts             滑动窗口限流（claim / verify / login）
│   └── utils.ts                  cn / 日期 / 核销码生成
└── prisma/
    ├── schema.prisma             数据模型
    └── seed.ts                   种子脚本
```

---

## ⚙️ NPM 脚本

| 命令 | 作用 |
|---|---|
| `npm run dev` | 开发服务器（hot reload） |
| `npm run build` | 生产构建 |
| `npm run db:reset` | 删库重建 + 种子（演示前常用） |
| `npm run db:seed` | 仅运行种子 |
| `npm run db:studio` | Prisma Studio 可视化数据 |

---

## 🛠️ 技术栈

- **框架**：Next.js 15（App Router）+ TypeScript
- **样式**：Tailwind CSS 3
- **UI**：手动维护的 shadcn-style 组件 + lucide-react
- **数据**：Prisma 5 + SQLite（本地）→ Postgres 替换 connection string 即可上生产
- **二维码**：`qrcode` 生成 / `html5-qrcode` 扫码
- **认证**：cookie + 工号（生产请替换为 SSO）

---

## 🚀 进阶功能

- ✅ **Excel/CSV 名单导入**（活动详情页 "导入名单"，支持替换/追加，工号匹配，未找到提示）
- ✅ **员工档案批量导入**（员工列表页 "批量导入"，strict/skip/overwrite 三种冲突策略 + 错误清单）
- ✅ **礼物 SKU CRUD**（礼物页 "+ 新增礼物" + 卡片编辑：商品定义 + 各分仓初始库存 + 删除保护）
- ✅ **补录领取**（活动详情页 "补录领取"，行政代发，跳过预约直接标记已领）
- ✅ **自动过期**（看板 "运行过期检查" 按钮 + `POST /api/cron/expire`）
- ✅ **用户权限管理**（员工列表页支持添加员工 / 改角色 / 分配楼宇 / 启停）
- ✅ **IM 推送 mock**（飞书 / 邮件双通道）
- ✅ **推送中心**（/admin/notifications：漏斗分析 + 手动催领 + 自动定时任务）
- ✅ **员工消息中心**（/m/messages：模拟 IM 消息卡，主页未读徽章）

### IM 通知触发点

| 时机 | 类型 | 触发 |
|---|---|---|
| 活动 `status` 变 `active` | `initial` | 自动 |
| 截止前 24h | `reminder_24h` | `/api/cron/notifications` 触发 |
| 截止前 2h | `reminder_2h` | `/api/cron/notifications` 触发 |
| 行政手动催领 | `last_call` | 推送中心按钮 |
| 员工预约成功 | `reserved_confirm` | 自动 |
| 员工核销成功 | `claimed_confirm` | 自动 |

通道按工号尾号 mock 分配（lark / email），1% 模拟失败。

### 用户权限规则

三种角色 + 三种状态：

| 角色 | 可访问 | 权限 |
|---|---|---|
| `admin` | `/admin` | 全部 — 活动 / 库存 / 员工 / 用户管理 |
| `verifier` | `/verify` | 仅核销**本楼宇**的预约 |
| `employee` | `/m` | 查看 / 领取自己的福利 |

防呆校验：

- ❌ 不能修改自己的角色或停用自己（防锁定）
- ❌ 不能把系统里**最后一个在职 admin** 降级或停用
- ❌ verifier 必须先分配楼宇
- ⚠️ 有领取记录的员工删除时会软删除（设为 resigned）

## 🛡️ 并发与可用性

为 3000 人规模的节日开抢场景做了**四层兜底**：

| 层 | 实现 | 防什么 |
|---|---|---|
| L1 应用限流 | `src/lib/rate-limit.ts` 滑动窗口 | 用户双击 / 脚本刷接口 |
| L2 SQL 原子扣减 | `$executeRaw` conditional UPDATE | 业务层 race window |
| L3 数据库写串行化 | SQLite / Turso 单写者 | L1 + L2 都被绕过时 |
| L4 唯一约束兜底 | `@@unique([campaignId, employeeId])` | 同一员工领多份 |

**限流策略**（单实例内存版，可换 Upstash Redis 升级为分布式）：

| 接口 | 限流 | Key |
|---|---|---|
| `POST /api/claims` | 10s 5 次 | per 员工 ID |
| `POST /api/verify` | 10s 30 次 | per 核销员 ID |
| `POST /api/auth/login` | 60s 10 次 | per IP（防工号枚举） |

被限流时返回 `429` + `Retry-After` 头。

**通知异步化**：员工预约/核销成功后的飞书/邮件推送用 Next.js 15 `after()` API，response 返回后再异步发送，不阻塞用户 RT。

**库存原子扣减写法**（[src/app/api/claims/route.ts](./src/app/api/claims/route.ts)）：

```sql
UPDATE Inventory
SET qtyReserved = qtyReserved + 1
WHERE warehouseId = ? AND giftId = ?
  AND qtyTotal > qtyReserved + qtyClaimed
```

WHERE 子句里把校验和写入合并成一条 SQL，受影响行数 = 0 → 缺货。**理论上 1000+ QPS 压测不会出现超卖**（账面 `qtyReserved + qtyClaimed > qtyTotal`）。

压测后对账 SQL（必须返回 0 行）：

```sql
SELECT * FROM Inventory WHERE qtyReserved + qtyClaimed > qtyTotal;
```

---

## 🚧 待办

- 真实飞书 / 邮件 API 接入（当前为 mock，逻辑闭环已具备）
- 异常工单（员工申诉、缺货登记）
- 跨楼宇调拨
- 代领授权
- 满意度收集
- 真实 SSO 接入
- 操作日志 / 审计

---

## 📋 验收清单

- [x] 行政可以在 10 分钟内创建一个完整批次
- [x] 员工从入口到二维码不超过 4 次点击
- [x] 分仓核销单次操作 ≤ 3 秒
- [x] 库存变更：事务 + SQL 原子扣减 + 唯一约束三重保证
- [x] 数据看板秒级响应
- [x] 限流：claim / verify / login 全部加上，防双击 / 防枚举
- [x] 通知异步化：`after()` 不阻塞用户 RT
- [x] 真实 200+ 人并发压测（k6 / artillery，跑完用对账 SQL 验证）
- [ ] 5 分钟培训视频（待录）
