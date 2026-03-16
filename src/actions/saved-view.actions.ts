"use server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";

// Get views visible to current user (personal + unhidden team views)
export async function getSavedViews() {
  const session = await auth();
  if (!session) return [];

  const allViews = await prisma.savedView.findMany({
    orderBy: [{ isTeamView: "desc" }, { name: "asc" }],
  });

  return allViews.filter((view) => {
    // Personal views: only show to owner
    if (!view.isTeamView) return view.userId === session.user.id;
    // Team views: show unless hidden by this user
    const hidden = (view.hiddenByUsers as string[] | null) ?? [];
    return !hidden.includes(session.user.id);
  });
}

// Create a saved view
export async function createSavedView(data: {
  name: string;
  filtersJson: Record<string, string>;
  sortJson?: Record<string, string>;
  isTeamView?: boolean;
}) {
  const session = await auth();
  if (!session) throw new Error("Unauthorized");
  if (data.isTeamView && !["ADMIN", "MANAGER"].includes(session.user.role)) {
    throw new Error("Only managers can create team views");
  }

  await prisma.savedView.create({
    data: {
      name: data.name,
      filtersJson: data.filtersJson,
      sortJson: data.sortJson ?? Prisma.JsonNull,
      isTeamView: data.isTeamView ?? false,
      userId: session.user.id,
    },
  });
  revalidatePath("/leads");
}

// Delete a saved view
export async function deleteSavedView(id: string) {
  const session = await auth();
  if (!session) throw new Error("Unauthorized");

  const view = await prisma.savedView.findUnique({ where: { id } });
  if (!view) throw new Error("View not found");
  if (view.isSystem) throw new Error("Cannot delete system views");
  if (
    view.userId !== session.user.id &&
    !["ADMIN", "MANAGER"].includes(session.user.role)
  ) {
    throw new Error("Unauthorized");
  }

  await prisma.savedView.delete({ where: { id } });
  revalidatePath("/leads");
}

// Hide a team view for the current user
export async function hideSavedView(id: string) {
  const session = await auth();
  if (!session) throw new Error("Unauthorized");

  const view = await prisma.savedView.findUnique({ where: { id } });
  if (!view || !view.isTeamView) throw new Error("Not a team view");

  const hidden = (view.hiddenByUsers as string[] | null) ?? [];
  if (!hidden.includes(session.user.id)) {
    await prisma.savedView.update({
      where: { id },
      data: { hiddenByUsers: [...hidden, session.user.id] },
    });
  }
  revalidatePath("/leads");
}

// Restore a hidden team view
export async function restoreSavedView(id: string) {
  const session = await auth();
  if (!session) throw new Error("Unauthorized");

  const view = await prisma.savedView.findUnique({ where: { id } });
  if (!view) throw new Error("View not found");

  const hidden = (view.hiddenByUsers as string[] | null) ?? [];
  await prisma.savedView.update({
    where: { id },
    data: { hiddenByUsers: hidden.filter((uid) => uid !== session.user.id) },
  });
  revalidatePath("/leads");
}

// Get hidden team views for restore UI
export async function getHiddenViews() {
  const session = await auth();
  if (!session) return [];

  const teamViews = await prisma.savedView.findMany({
    where: { isTeamView: true },
  });

  return teamViews.filter((view) => {
    const hidden = (view.hiddenByUsers as string[] | null) ?? [];
    return hidden.includes(session.user.id);
  });
}
