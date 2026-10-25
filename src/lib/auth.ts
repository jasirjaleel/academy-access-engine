import "server-only";
import { currentUser } from "@clerk/nextjs/server";
import { notFound } from "next/navigation";

/** 404 (not 403) for non-admins, so the admin area's existence isn't revealed. */
export async function requireAdmin() {
  const user = await currentUser();
  if (!user || user.publicMetadata.role !== "admin") notFound();
  return user;
}
