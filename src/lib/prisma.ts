import { PrismaClient } from "@prisma/client";
import { PrismaLibSQL } from "@prisma/adapter-libsql";
import { createClient } from "@libsql/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function makePrisma() {
  const url = process.env.DATABASE_URL ?? "file:./prisma/dev.db";
  const authToken = process.env.TURSO_AUTH_TOKEN;

  // 生产环境 / Turso：用 libsql adapter（支持 libsql://、https://、wss://）
  // 本地开发：file: 协议直接走 PrismaLibSQL 也 OK（@libsql/client 原生支持 file://）
  const libsqlUrl = url.startsWith("file:")
    ? url.replace("file:", "file:")
    : url;

  const libsql = createClient({
    url: libsqlUrl,
    authToken,
  });

  // 关键：libsql 默认不开 SQLite 外键约束，会让 schema 里 onDelete:Cascade 失效、
  // 也让插入孤儿 FK（如不存在的 warehouseId）静默成功。这里强制开启，确保 DB 完整性。
  libsql.execute("PRAGMA foreign_keys = ON").catch((e) => {
    console.error("Failed to enable foreign_keys PRAGMA:", e);
  });

  const adapter = new PrismaLibSQL(libsql);

  return new PrismaClient({
    adapter,
    log:
      process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });
}

export const prisma = globalForPrisma.prisma ?? makePrisma();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
