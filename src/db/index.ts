import "server-only";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { env } from "@/lib/env";
import * as schema from "./schema";

// Reuse one client across hot reloads in development.
const globalForDb = globalThis as unknown as { pgClient?: ReturnType<typeof postgres> };

// prepare: false is required by the Supabase transaction pooler.
// Timeouts make dropped/half-open connections (hot reloads, serverless freezes) get recycled
// instead of holding pooler slots until the database's statement timeout fires.
const client =
  globalForDb.pgClient ??
  postgres(env.DATABASE_URL, {
    prepare: false,
    // The session pooler allows 15 clients in total. On Vercel every instance gets its own pool,
    // so a webhook burst (e.g. a test clock advance) would fill it at 5 each; 1 each scales out instead.
    max: env.VERCEL ? 1 : 5,
    idle_timeout: 20,
    max_lifetime: 60 * 10,
    connect_timeout: 10,
  });
if (env.NODE_ENV !== "production") globalForDb.pgClient = client;

export const db = drizzle(client, { schema });
export type DB = typeof db;
