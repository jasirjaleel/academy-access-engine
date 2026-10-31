import "server-only";
import { isAdmin } from "./roles";
import { createSupabaseAdmin } from "./supabase/admin";

/** Auth users with app_metadata.role === "admin" (staff, not students). */
export async function getAdminUserIds(): Promise<string[]> {
  const { data, error } = await createSupabaseAdmin().auth.admin.listUsers({ perPage: 1000 });
  if (error) throw error;
  return data.users.filter(isAdmin).map((u) => u.id);
}
