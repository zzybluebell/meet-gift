import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, requireRole } from "@/lib/auth";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const currentUser = await requireRole(["admin"]);
    const { id } = await params;
    const body = await req.json();

    const target = await prisma.employee.findUnique({ where: { id } });
    if (!target) return NextResponse.json({ error: "员工不存在" }, { status: 404 });

    const updates: any = {};

    // 可改字段
    if (body.name !== undefined) updates.name = String(body.name).trim();
    if (body.department !== undefined) updates.department = String(body.department).trim();
    if (body.gender !== undefined) updates.gender = body.gender;
    if (body.hasChildren !== undefined) updates.hasChildren = !!body.hasChildren;
    if (body.email !== undefined) updates.email = body.email?.trim() || null;
    if (body.buildingId !== undefined) updates.buildingId = body.buildingId || null;
    if (body.birthDate !== undefined) {
      updates.birthDate = body.birthDate ? new Date(body.birthDate) : null;
    }
    if (body.hireDate !== undefined && body.hireDate) {
      updates.hireDate = new Date(body.hireDate);
    }

    // 角色变更：防呆
    if (body.role !== undefined && body.role !== target.role) {
      if (!["employee", "admin", "verifier"].includes(body.role)) {
        return NextResponse.json({ error: "角色无效" }, { status: 400 });
      }
      // 验证：不允许把自己降级
      if (currentUser.id === target.id && body.role !== "admin") {
        return NextResponse.json(
          { error: "为了避免锁定，不能修改自己的角色，请先让另一位管理员调整" },
          { status: 400 }
        );
      }
      // 验证：不允许把最后一个 admin 降级
      if (target.role === "admin" && body.role !== "admin") {
        const otherAdmins = await prisma.employee.count({
          where: { role: "admin", status: "active", id: { not: target.id } },
        });
        if (otherAdmins === 0) {
          return NextResponse.json(
            { error: "系统至少需要保留 1 个在职管理员" },
            { status: 400 }
          );
        }
      }
      // 验证：verifier 必须有楼宇
      const newBuildingId = updates.buildingId !== undefined ? updates.buildingId : target.buildingId;
      if (body.role === "verifier" && !newBuildingId) {
        return NextResponse.json({ error: "核销员必须先分配楼宇" }, { status: 400 });
      }
      updates.role = body.role;
    }

    // 状态变更：防呆
    if (body.status !== undefined && body.status !== target.status) {
      if (!["active", "leave", "resigned"].includes(body.status)) {
        return NextResponse.json({ error: "状态无效" }, { status: 400 });
      }
      if (currentUser.id === target.id && body.status !== "active") {
        return NextResponse.json(
          { error: "为了避免锁定，不能停用/标记离职自己" },
          { status: 400 }
        );
      }
      // 不允许停用最后一个 admin
      const willBeRole = updates.role || target.role;
      if (
        willBeRole === "admin" &&
        body.status !== "active"
      ) {
        const otherActiveAdmins = await prisma.employee.count({
          where: { role: "admin", status: "active", id: { not: target.id } },
        });
        if (otherActiveAdmins === 0) {
          return NextResponse.json(
            { error: "系统至少需要保留 1 个在职管理员" },
            { status: 400 }
          );
        }
      }
      updates.status = body.status;
    }

    const updated = await prisma.employee.update({
      where: { id },
      data: updates,
      include: { building: true },
    });

    return NextResponse.json({ ok: true, employee: updated });
  } catch (e: any) {
    if (e.message === "UNAUTHORIZED") return NextResponse.json({ error: "请先登录" }, { status: 401 });
    if (e.message === "FORBIDDEN") return NextResponse.json({ error: "权限不足" }, { status: 403 });
    console.error(e);
    return NextResponse.json({ error: e.message || "服务器错误" }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const currentUser = await requireRole(["admin"]);
    const { id } = await params;
    if (currentUser.id === id) {
      return NextResponse.json({ error: "不能删除自己" }, { status: 400 });
    }
    const target = await prisma.employee.findUnique({
      where: { id },
      include: { _count: { select: { claims: true } } },
    });
    if (!target) return NextResponse.json({ error: "员工不存在" }, { status: 404 });

    if (target.role === "admin") {
      const otherAdmins = await prisma.employee.count({
        where: { role: "admin", status: "active", id: { not: id } },
      });
      if (otherAdmins === 0) {
        return NextResponse.json({ error: "至少保留 1 个在职管理员" }, { status: 400 });
      }
    }

    // 有领取记录的：软删除（status=resigned）
    if (target._count.claims > 0) {
      await prisma.employee.update({
        where: { id },
        data: { status: "resigned" },
      });
      return NextResponse.json({ ok: true, mode: "soft", message: "已有领取记录，标记为离职" });
    }

    // 没有领取记录的：硬删除
    await prisma.employee.delete({ where: { id } });
    return NextResponse.json({ ok: true, mode: "hard" });
  } catch (e: any) {
    if (e.message === "UNAUTHORIZED") return NextResponse.json({ error: "请先登录" }, { status: 401 });
    if (e.message === "FORBIDDEN") return NextResponse.json({ error: "权限不足" }, { status: 403 });
    console.error(e);
    return NextResponse.json({ error: e.message || "服务器错误" }, { status: 500 });
  }
}
