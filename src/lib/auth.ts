import { cookies } from "next/headers";
import { prisma } from "./prisma";

const SESSION_COOKIE = "meetgift_session";

export type SessionUser = {
  id: string;
  employeeNo: string;
  name: string;
  role: "employee" | "admin" | "verifier";
  buildingId: string | null;
  buildingName: string | null;
};

export async function getCurrentUser(): Promise<SessionUser | null> {
  const c = await cookies();
  const employeeId = c.get(SESSION_COOKIE)?.value;
  if (!employeeId) return null;
  const e = await prisma.employee.findUnique({
    where: { id: employeeId },
    include: { building: true },
  });
  if (!e || e.status !== "active") return null;
  return {
    id: e.id,
    employeeNo: e.employeeNo,
    name: e.name,
    role: e.role as SessionUser["role"],
    buildingId: e.buildingId,
    buildingName: e.building?.name ?? null,
  };
}

export async function setSession(employeeId: string) {
  const c = await cookies();
  c.set(SESSION_COOKIE, employeeId, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
}

export async function clearSession() {
  const c = await cookies();
  c.delete(SESSION_COOKIE);
}

export async function requireRole(roles: SessionUser["role"][]): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) throw new Error("UNAUTHORIZED");
  if (!roles.includes(user.role)) throw new Error("FORBIDDEN");
  return user;
}
