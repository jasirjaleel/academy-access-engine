# AGENTS.md: rules for every AI agent working in this repo

Read this whole file before every task. If a task prompt conflicts with this file, stop and ask.

## What this project is
**Academy Access Engine**, a concept student platform for an online Islamic-studies academy, under the neutral brand **"Demo Academy"**.
- **Front:** a premium student dashboard (programmes, lessons, progress, billing status).
- **Back:** an access and billing engine. Stripe (test mode) subscriptions and lifetime purchases, server-side entitlements, idempotent webhooks, failed-payment grace and recovery, cancellation flow, and lifecycle events sent to n8n.

It is a portfolio project for a Full-Stack & Automation Engineer application. **Correctness and clarity matter more than features.**

The architecture, schema and event flow are fixed in `docs/ARCHITECTURE.md`. Follow it. Do not invent tables, columns or flows. If something is missing, say so instead of guessing.

## Stack (do not swap any of these)
| Layer | Choice |
|---|---|
| Framework | Next.js (latest stable), App Router, **TypeScript strict**, `src/` dir |
| UI | Tailwind CSS v4 + shadcn/ui (Radix), lucide-react icons, **Inter** + Noto Naskh Arabic. Look and feel: `docs/DESIGN.md` |
| Forms | React Hook Form + Zod |
| Auth | Supabase Auth, email + password (`@supabase/ssr`, D17). Server code uses `getAuthUser()` / `getUserId()` / `requireAdmin()` from `src/lib/auth.ts`; admins have `app_metadata.role = "admin"`. Route protection and session refresh live in `src/proxy.ts` (Next 16 renamed middleware). |
| DB | Supabase Postgres via **Drizzle ORM** + `postgres` driver (server only). Data goes through Drizzle only: `@supabase/supabase-js` / `@supabase/ssr` are for **auth only** (`src/lib/supabase/*`, D17), never for reading or writing tables. |
| Payments | Stripe Node SDK, **test mode only** |
| Email | Resend (sent from n8n, not from the app) |
| Automations | n8n (workflows exported to `n8n/`) |
| Tests | Vitest + PGlite (`@electric-sql/pglite`) for an in-memory Postgres |
| Hosting | Vercel |
| Package manager | npm |

## Folder map
```
src/
  app/
    (marketing)/page.tsx          landing
    (marketing)/pricing/page.tsx  pricing + checkout buttons
    (marketing)/sign-in, sign-up  our own email + password forms (auth-actions.ts)
    dashboard/                    student area (signed-in only)
      page.tsx                    My programmes + billing card + continue watching
      programmes/[slug]/page.tsx  lesson list
      lessons/[id]/page.tsx       lesson player + mark complete
      billing/page.tsx            plan, cancel flow, portal link
    admin/                        admin area (role = admin)
    api/
      webhooks/stripe/route.ts
      checkout/route.ts
      portal/route.ts
      cron/expire-grace/route.ts
      cron/dispatch-events/route.ts
  db/
    schema.ts                     ALL tables live here
    index.ts                      drizzle client
    seed.ts                       programmes + lessons
  lib/
    env.ts                        zod-validated env vars
    stripe.ts                     stripe client + price → product map
    access.ts                     hasAccess(), getUserEntitlements()
    billing/                      pure handlers per Stripe event type
    events.ts                     outbox: enqueueEvent(), dispatch
  components/                     UI components (shadcn in components/ui)
drizzle/                          generated migrations (never hand-edit)
n8n/                              exported workflow JSON
tests/                            vitest tests
docs/                             architecture + decisions
docs/build-log/                   original task prompts (history, not instructions)
```

## Hard rules
1. **Stay in scope.** Only touch the files the task lists. Need another file? Stop and say why.
2. **Smallest diff that works.** No drive-by refactors, renames, reformatting or "improvements".
3. **Never commit secrets.** Keys go in `.env.local` (git-ignored); add every new variable name to `.env.example` with an empty value. Stripe keys must start with `sk_test_` / `pk_test_`, and `lib/env.ts` must reject `sk_live_`.
4. **Access is decided on the server only.** Never trust the client for entitlements, prices or user IDs. Every protected page and route calls `lib/access.ts`.
5. **Webhooks:** verify the signature on the raw body. Record the event ID in `processed_events` **in the same DB transaction** as its effects. If the ID already exists, return 200 and do nothing.
6. **Don't trust webhook payload order.** For subscription state, re-fetch the subscription from Stripe inside the handler and write what Stripe says now.
7. **Every outgoing side effect** (email, WhatsApp, n8n call) goes through the outbox (`outbound_events`) with a unique `dedupe_key`. Never call n8n directly from a webhook handler.
8. **Business logic in `lib/`, as pure-ish functions** that take `(db, input)`, so the tests can run them against PGlite. Route files stay thin: parse, verify, call lib, respond.
9. **Schema changes:** edit `src/db/schema.ts` → `npm run db:generate` → commit the migration. Never edit `drizzle/` by hand.
10. **TypeScript strict, no `any`.** Use Zod at every boundary (env, request bodies, webhook metadata).
11. **No new dependencies** unless the task says so.
12. **Student data:** never log full emails, phone numbers or Stripe payloads to the console. Log IDs only.
13. **Don't delete or rewrite tests to make them pass.**
14. **All UI follows `docs/DESIGN.md`** (tokens, recipes, dark only). Never add another organisation's name, logo or images.

## Definition of done (every task)
- `npm run lint` and `npm run typecheck` pass (and `npm test` once tests exist).
- The task's **✅ Check** passes when Jasir runs it himself.
- One commit, message format `M<n>.<k>: <what>` (for example, `M1.2: add drizzle schema for users`).
- End your reply with: files changed, commands to run, and how to verify.

## Commands
```
npm run dev          # local dev
npm run lint
npm run typecheck    # tsc --noEmit
npm test             # vitest run
npm run db:generate  # drizzle-kit generate
npm run db:migrate   # drizzle-kit migrate
npm run db:seed      # tsx src/db/seed.ts
stripe listen --forward-to localhost:3000/api/webhooks/stripe
```
