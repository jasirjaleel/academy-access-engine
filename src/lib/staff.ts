import "server-only";
import { clerkClient } from "@clerk/nextjs/server";

/** Clerk users with publicMetadata.role === "admin" (staff, not students). */
export async function getAdminUserIds(): Promise<string[]> {
  const client = await clerkClient();
  const { data } = await client.users.getUserList({ limit: 500 });
  return data.filter((u) => u.publicMetadata.role === "admin").map((u) => u.id);
}
