import { z } from "zod";

// Read lazily so importing this file never crashes a build that has no Supabase env yet.
// (Not via lib/env.ts: the proxy imports this, and env.ts also requires the database and server-only vars.)
export function supabaseUrl() {
  return z.string().url("NEXT_PUBLIC_SUPABASE_URL is required").parse(process.env.NEXT_PUBLIC_SUPABASE_URL);
}

/** The public (publishable / anon) key. Safe in the browser: RLS has no policies, so it can't read our tables (D12). */
export function supabaseKey() {
  return z
    .string()
    .min(1, "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY is required")
    .parse(process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
}
