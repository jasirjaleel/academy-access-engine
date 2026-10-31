import "server-only";
import type { User } from "@supabase/supabase-js";
import { notFound } from "next/navigation";
import { cache } from "react";
import { isAdmin } from "./roles";
import { createSupabaseServer } from "./supabase/server";

/** The signed-in Supabase user, verified with the auth server (once per request). */
export const getAuthUser = cache(async (): Promise<User | null> => {
  const supabase = await createSupabaseServer();
  const { data } = await supabase.auth.getUser();
  return data.user ?? null;
});

export async function getUserId(): Promise<string | null> {
  return (await getAuthUser())?.id ?? null;
}

/** 404 (not 403) for non-admins, so the admin area's existence isn't revealed. */
export async function requireAdmin(): Promise<User> {
  const user = await getAuthUser();
  if (!user || !isAdmin(user)) notFound();
  return user;
}
