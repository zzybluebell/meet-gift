import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// ===== 配置 =====
const NUM_EMPLOYEES = 100;
const DEPARTMENTS = ["研发中心", "产品中心", "设计中心", "市场部", "行政人事"];
const BUILDINGS = [
  { name: "科技园 A 座", address: "粤海街道科技园南区 A 座" },
  { name: "科技园 B 座", address: "粤海街道科技园南区 B 座" },
  { name: "海岸城写字楼", address: "南山区海岸城商务中心" },
];

const FIRST_NAMES = ["伟", "芳", "娜", "敏", "静", "丽", "强", "磊", "军", "洋", "勇", "艳", "杰", "娟", "涛", "明", "超", "秀英", "霞", "平", "刚", "桂英", "嘉怡", "宇轩", "梓涵", "浩然", "雨彤", "诗涵", "子轩", "若曦"];
const LAST_NAMES = ["王", "李", "张", "刘", "陈", "杨", "黄", "赵", "周", "吴", "徐", "孙", "马", "朱", "胡", "郭", "何", "高", "林", "罗", "郑", "梁", "谢", "宋", "唐", "许", "韩", "冯", "邓", "曹"];

function rand<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}
function randInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
function randomName() {
  return rand(LAST_NAMES) + rand(FIRST_NAMES);
}
function randomDate(start: Date, end: Date): Date {
  return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
}

async function main() {
  console.log("🌱 开始播种...");

  // 清空旧数据（按依赖顺序）
  await prisma.claim.deleteMany();
  await prisma.eligibility.deleteMany();
  await prisma.campaignGift.deleteMany();
  await prisma.campaign.deleteMany();
  await prisma.inventory.deleteMany();
  await prisma.gift.deleteMany();
  await prisma.warehouse.deleteMany();
  await prisma.employee.deleteMany();
  await prisma.building.deleteMany();
  console.log("  已清空旧数据");

  // ----- 楼宇 + 仓库 -----
  const buildings = await Promise.all(
    BUILDINGS.map((b) =>
      prisma.building.create({
        data: {
          ...b,
          warehouses: { create: {} },
        },
        include: { warehouses: true },
      })
    )
  );
  console.log(`  创建 ${buildings.length} 个楼宇 + 分仓`);

  // ----- 礼物 SKU -----
  const gifts = await Promise.all([
    prisma.gift.create({
      data: {
        name: "中秋月饼礼盒·广式",
        description: "经典广式月饼 8 枚装，含蛋黄莲蓉、五仁、豆沙、椰蓉",
        imageUrl: "🥮",
        value: 18800,
        category: "food",
        allergenTags: JSON.stringify(["nuts", "egg"]),
      },
    }),
    prisma.gift.create({
      data: {
        name: "中秋月饼礼盒·苏式",
        description: "苏式酥皮月饼 6 枚装，鲜肉、玫瑰、椒盐",
        imageUrl: "🥮",
        value: 16800,
        category: "food",
        allergenTags: JSON.stringify(["gluten"]),
      },
    }),
    prisma.gift.create({
      data: {
        name: "中秋月饼礼盒·冰皮",
        description: "冰皮月饼 8 枚装，芒果、抹茶、巧克力、芋泥",
        imageUrl: "🥮",
        value: 19800,
        category: "food",
        allergenTags: JSON.stringify(["dairy"]),
      },
    }),
    prisma.gift.create({
      data: {
        name: "端午粽子礼盒",
        description: "嘉兴粽子 10 枚装，咸肉、豆沙、八宝",
        imageUrl: "🎋",
        value: 12800,
        category: "food",
        allergenTags: JSON.stringify([]),
      },
    }),
    prisma.gift.create({
      data: {
        name: "女神节香薰礼盒",
        description: "进口精油香薰 + 手工皂",
        imageUrl: "🌸",
        value: 28800,
        category: "daily",
        allergenTags: JSON.stringify([]),
      },
    }),
    prisma.gift.create({
      data: {
        name: "儿童节亲子拼图",
        description: "1000 片亲子拼图 + 益智玩具",
        imageUrl: "🧩",
        value: 9900,
        category: "daily",
        allergenTags: JSON.stringify([]),
      },
    }),
    prisma.gift.create({
      data: {
        name: "司庆定制保温杯",
        description: "公司 logo 定制 500ml 保温杯",
        imageUrl: "🍵",
        value: 8800,
        category: "daily",
        allergenTags: JSON.stringify([]),
      },
    }),
  ]);
  console.log(`  创建 ${gifts.length} 个礼物 SKU`);

  // ----- 员工 -----
  // 先创建几个特殊角色账号方便 demo
  const adminUser = await prisma.employee.create({
    data: {
      employeeNo: "10001",
      name: "小 A（行政统筹）",
      gender: "F",
      department: "行政人事",
      buildingId: buildings[0].id,
      hireDate: new Date("2020-03-15"),
      birthDate: new Date("1992-06-20"),
      hasChildren: true,
      role: "admin",
      email: "admin@demo.com",
    },
  });

  const verifierUsers = await Promise.all(
    buildings.map((b, i) =>
      prisma.employee.create({
        data: {
          employeeNo: `2000${i + 1}`,
          name: `小 C${i + 1}（${b.name} 分仓）`,
          gender: i % 2 === 0 ? "F" : "M",
          department: "行政人事",
          buildingId: b.id,
          hireDate: new Date("2021-01-10"),
          birthDate: new Date("1995-03-12"),
          hasChildren: false,
          role: "verifier",
          email: `verifier${i + 1}@demo.com`,
        },
      })
    )
  );

  // 给每个分仓挂上管理员
  for (let i = 0; i < buildings.length; i++) {
    await prisma.warehouse.update({
      where: { id: buildings[i].warehouses[0].id },
      data: { managerId: verifierUsers[i].id },
    });
  }

  // 几个 demo 员工账号便于演示
  const demoEmployees = [
    { no: "30001", name: "员工小 B", gender: "M", dept: "研发中心", hasChildren: false, buildingIdx: 0 },
    { no: "30002", name: "员工小 D", gender: "F", dept: "设计中心", hasChildren: true, buildingIdx: 1 },
    { no: "30003", name: "员工小 E", gender: "F", dept: "产品中心", hasChildren: false, buildingIdx: 2 },
  ];
  await Promise.all(
    demoEmployees.map((e) =>
      prisma.employee.create({
        data: {
          employeeNo: e.no,
          name: e.name,
          gender: e.gender,
          department: e.dept,
          buildingId: buildings[e.buildingIdx].id,
          hireDate: randomDate(new Date("2018-01-01"), new Date("2024-06-01")),
          birthDate: randomDate(new Date("1985-01-01"), new Date("2000-12-31")),
          hasChildren: e.hasChildren,
          role: "employee",
          email: `${e.no}@demo.com`,
        },
      })
    )
  );

  // 批量随机员工
  const bulk = Array.from({ length: NUM_EMPLOYEES - 4 - verifierUsers.length }, (_, i) => {
    const buildingId = buildings[i % buildings.length].id;
    const gender = Math.random() < 0.45 ? "F" : "M";
    return prisma.employee.create({
      data: {
        employeeNo: `4${(i + 1).toString().padStart(4, "0")}`,
        name: randomName(),
        gender,
        department: rand(DEPARTMENTS),
        buildingId,
        hireDate: randomDate(new Date("2015-01-01"), new Date("2025-09-01")),
        birthDate: randomDate(new Date("1980-01-01"), new Date("2002-12-31")),
        hasChildren: Math.random() < 0.35,
        role: "employee",
      },
    });
  });
  await Promise.all(bulk);
  const totalEmployees = await prisma.employee.count();
  console.log(`  创建 ${totalEmployees} 个员工（含 1 管理员 / ${verifierUsers.length} 核销员）`);

  // ----- 库存：每个仓库都有月饼 3 款 + 粽子 + 司庆杯 -----
  const warehouses = await prisma.warehouse.findMany();
  for (const wh of warehouses) {
    for (const g of gifts) {
      // 各楼宇库存稍微差异化，部分款 0 库存模拟"该楼缺货"
      const isMooncake = g.name.includes("月饼");
      const isDuanwu = g.name.includes("粽子");
      const isAnniv = g.name.includes("保温杯");
      let total = 0;
      if (isMooncake) total = randInt(40, 80);
      else if (isDuanwu) total = randInt(30, 60);
      else if (isAnniv) total = randInt(50, 90);
      else total = randInt(0, 20);
      await prisma.inventory.create({
        data: {
          warehouseId: wh.id,
          giftId: g.id,
          qtyTotal: total,
          qtyReserved: 0,
          qtyClaimed: 0,
        },
      });
    }
  }
  console.log(`  创建 ${warehouses.length * gifts.length} 条库存记录`);

  // ----- 活动：3 个 demo 批次 -----
  const now = new Date();
  const in1Day = new Date(now.getTime() + 86400000);
  const in7Days = new Date(now.getTime() + 7 * 86400000);
  const ago30Days = new Date(now.getTime() - 30 * 86400000);
  const ago25Days = new Date(now.getTime() - 25 * 86400000);

  // 1. 进行中：中秋节（多 SKU 自选）
  const midAutumn = await prisma.campaign.create({
    data: {
      name: "2026 中秋福利",
      holidayType: "mid_autumn",
      description: "祝大家中秋快乐 🌕 三款月饼任选一份",
      startAt: new Date(now.getTime() - 86400000),
      endAt: in7Days,
      selectionMode: "choose_one",
      eligibilityRule: JSON.stringify({ type: "ALL" }),
      status: "active",
      createdById: adminUser.id,
      campaignGifts: {
        create: [
          { giftId: gifts[0].id, qtyPerEmployee: 1 },
          { giftId: gifts[1].id, qtyPerEmployee: 1 },
          { giftId: gifts[2].id, qtyPerEmployee: 1 },
        ],
      },
    },
  });

  // 2. 进行中：女神节（限女员工，固定礼物）
  const womens = await prisma.campaign.create({
    data: {
      name: "2026 女神节",
      holidayType: "womens",
      description: "致敬每一位女性同事 🌸",
      startAt: new Date(now.getTime() - 2 * 86400000),
      endAt: in1Day,
      selectionMode: "fixed",
      eligibilityRule: JSON.stringify({
        type: "AND",
        rules: [{ field: "gender", op: "=", value: "F" }],
      }),
      status: "active",
      createdById: adminUser.id,
      campaignGifts: { create: [{ giftId: gifts[4].id, qtyPerEmployee: 1 }] },
    },
  });

  // 3. 已结束：端午节（全员，固定礼物）
  const dragonBoat = await prisma.campaign.create({
    data: {
      name: "2025 端午福利",
      holidayType: "dragon_boat",
      description: "端午安康 🐉",
      startAt: ago30Days,
      endAt: ago25Days,
      selectionMode: "fixed",
      eligibilityRule: JSON.stringify({ type: "ALL" }),
      status: "closed",
      createdById: adminUser.id,
      campaignGifts: { create: [{ giftId: gifts[3].id, qtyPerEmployee: 1 }] },
    },
  });

  console.log(`  创建 3 个 demo 活动`);

  // ----- 资格名单（按规则计算）-----
  const allEmployees = await prisma.employee.findMany({
    where: { status: "active" },
  });

  // 中秋：全员
  await prisma.eligibility.createMany({
    data: allEmployees.map((e) => ({
      campaignId: midAutumn.id,
      employeeId: e.id,
      status: "eligible",
    })),
  });

  // 女神节：女员工
  const femaleEmployees = allEmployees.filter((e) => e.gender === "F");
  await prisma.eligibility.createMany({
    data: femaleEmployees.map((e) => ({
      campaignId: womens.id,
      employeeId: e.id,
      status: "eligible",
    })),
  });

  // 端午：全员
  await prisma.eligibility.createMany({
    data: allEmployees.map((e) => ({
      campaignId: dragonBoat.id,
      employeeId: e.id,
      status: "eligible",
    })),
  });

  console.log(`  生成资格名单：中秋 ${allEmployees.length} / 女神 ${femaleEmployees.length} / 端午 ${allEmployees.length}`);

  // ----- 端午部分人已领（让数据看板有内容）-----
  const dragonClaimers = allEmployees.slice(0, Math.floor(allEmployees.length * 0.85));
  for (const emp of dragonClaimers) {
    const wh = warehouses.find((w) => w.buildingId === emp.buildingId)!;
    const code = (100000 + Math.floor(Math.random() * 900000)).toString();
    const token = Math.random().toString(36).slice(2, 18);
    await prisma.claim.create({
      data: {
        campaignId: dragonBoat.id,
        employeeId: emp.id,
        giftId: gifts[3].id,
        warehouseId: wh.id,
        claimCode: code,
        qrToken: token,
        status: "claimed",
        reservedAt: ago30Days,
        claimedAt: randomDate(ago30Days, ago25Days),
        verifierId: verifierUsers[Math.floor(Math.random() * verifierUsers.length)].id,
      },
    });
    // 更新库存
    await prisma.inventory.update({
      where: { warehouseId_giftId: { warehouseId: wh.id, giftId: gifts[3].id } },
      data: { qtyClaimed: { increment: 1 } },
    });
    // 更新资格
    await prisma.eligibility.update({
      where: { campaignId_employeeId: { campaignId: dragonBoat.id, employeeId: emp.id } },
      data: { status: "claimed" },
    });
  }
  console.log(`  生成 ${dragonClaimers.length} 条端午领取记录`);

  // ----- 中秋部分人已预约 -----
  const midClaimers = allEmployees.slice(0, Math.floor(allEmployees.length * 0.3));
  for (const emp of midClaimers) {
    const wh = warehouses.find((w) => w.buildingId === emp.buildingId)!;
    const chosenGift = gifts[Math.floor(Math.random() * 3)]; // 三款月饼中选一
    const code = (100000 + Math.floor(Math.random() * 900000)).toString();
    const token = Math.random().toString(36).slice(2, 18);
    const isAlreadyClaimed = Math.random() < 0.4;
    await prisma.claim.create({
      data: {
        campaignId: midAutumn.id,
        employeeId: emp.id,
        giftId: chosenGift.id,
        warehouseId: wh.id,
        claimCode: code,
        qrToken: token,
        status: isAlreadyClaimed ? "claimed" : "reserved",
        reservedAt: new Date(now.getTime() - randInt(0, 24) * 3600000),
        claimedAt: isAlreadyClaimed ? new Date(now.getTime() - randInt(0, 12) * 3600000) : null,
        verifierId: isAlreadyClaimed ? verifierUsers[Math.floor(Math.random() * verifierUsers.length)].id : null,
      },
    });
    await prisma.inventory.update({
      where: { warehouseId_giftId: { warehouseId: wh.id, giftId: chosenGift.id } },
      data: isAlreadyClaimed
        ? { qtyClaimed: { increment: 1 } }
        : { qtyReserved: { increment: 1 } },
    });
    await prisma.eligibility.update({
      where: { campaignId_employeeId: { campaignId: midAutumn.id, employeeId: emp.id } },
      data: { status: isAlreadyClaimed ? "claimed" : "eligible" },
    });
  }
  console.log(`  生成 ${midClaimers.length} 条中秋领取记录`);

  console.log("\n✅ 播种完成！\n");
  console.log("--- 测试账号 ---");
  console.log("  行政管理员：工号 10001 （小 A）");
  console.log("  分仓核销员：工号 20001 / 20002 / 20003");
  console.log("  普通员工：  工号 30001 / 30002 / 30003");
  console.log("");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
