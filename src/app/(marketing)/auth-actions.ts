"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { safeNext } from "@/lib/safe-next";
import { createSupabaseServer } from "@/lib/supabase/server";

export type AuthState = { error?: string; email?: string } | undefined;

const signInSchema = z.object({
  email: z.string().trim().toLowerCase().email("Please enter a valid email."),
  password: z.string().min(1, "Please enter your password."),
});

const signUpSchema = z.object({
  name: z.string().trim().min(1, "Please enter your name.").max(100),
  email: z.string().trim().toLowerCase().email("Please enter a valid email."),
  password: z.string().min(8, "Use at least 8 characters."),
});

export async function signInAction(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = signInSchema.safeParse({ email: formData.get("email"), password: formData.get("password") });
  const email = String(formData.get("email") ?? "");
  if (!parsed.success) return { error: parsed.error.issues[0]?.message, email };

  const supabase = await createSupabaseServer();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  // One message for both cases, so the form doesn't reveal which emails have accounts.
  if (error) return { error: "Wrong email or password.", email };
  redirect(safeNext(formData.get("next")));
}

export async function signUpAction(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = signUpSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
  });
  const email = String(formData.get("email") ?? "");
  if (!parsed.success) return { error: parsed.error.issues[0]?.message, email };

  const supabase = await createSupabaseServer();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: { data: { full_name: parsed.data.name } },
  });
  if (error) {
    // Supabase's own messages can say "User already registered", so only password advice is passed through.
    if (error.code === "weak_password") return { error: error.message, email };
    return { error: "We couldn't create an account with these details. If you already have one, sign in instead.", email };
  }
  // Email confirmation is off for now, so sign-up returns a session straight away.
  if (!data.session) return { error: "Check your email to confirm your account, then sign in.", email };
  redirect(safeNext(formData.get("next")));
}

export async function signOutAction() {
  const supabase = await createSupabaseServer();
  await supabase.auth.signOut();
  redirect("/");
}
