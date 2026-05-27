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

  const adapter = new PrismaLibSQL(libsql);

  return new PrismaClient({
    adapter,
    log:
      process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });
}

export const prisma = globalForPrisma.prisma ?? makePrisma();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
