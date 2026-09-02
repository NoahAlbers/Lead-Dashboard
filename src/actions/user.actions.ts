"use server";

import { prisma } from "@/lib/db";
import { auth, assertRole } from "@/lib/auth";
import { userSchema } from "@/lib/validators/admin";
import { hashSync } from "bcryptjs";
import { revalidatePath } from "next/cache";

export async function getUsers() {
  const users = await prisma.user.findMany({
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      active: true,
      createdAt: true,
      lastActiveAt: true,
      inviteExpiresAt: true,
    },
    orderBy: { name: "asc" },
  });
  return users.map((u) => ({
    ...u,
    lastActiveAt: u.lastActiveAt?.toISOString() ?? null,
    inviteExpiresAt: u.inviteExpiresAt?.toISOString() ?? null,
  }));
}

export async function createUser(data: unknown) {
  const session = await auth();
  assertRole(session, "ADMIN");

  const parsed = userSchema.parse(data);
  if (!parsed.password) throw new Error("Password is required for new users");

  const user = await prisma.user.create({
    data: {
      name: parsed.name,
      email: parsed.email,
      passwordHash: hashSync(parsed.password, 12),
      role: parsed.role,
      active: parsed.active,
    },
  });
  revalidatePath("/admin/users");
  return { id: user.id, name: user.name, email: user.email, role: user.role };
}

export async function updateUser(id: string, data: unknown) {
  const session = await auth();
  assertRole(session, "ADMIN");

  const parsed = userSchema.parse(data);

  const updateData: Record<string, unknown> = {
    name: parsed.name,
    email: parsed.email,
    role: parsed.role,
    active: parsed.active,
  };

  if (parsed.password) {
    updateData.passwordHash = hashSync(parsed.password, 12);
  }

  const user = await prisma.user.update({
    where: { id },
    data: updateData,
  });
  revalidatePath("/admin/users");
  return { id: user.id, name: user.name, email: user.email, role: user.role };
}

export async function deleteUser(id: string) {
  const session = await auth();
  assertRole(session, "ADMIN");

  // Don't allow deleting yourself
  if (session!.user.id === id) throw new Error("Cannot delete yourself");

  await prisma.user.update({ where: { id }, data: { active: false } });
  revalidatePath("/admin/users");
}
