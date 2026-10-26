# Opus checkpoint review prompt

Paste into Claude Opus (Claude Code in this folder works best, because it can read the files itself):

---

Review checkpoint **[A | B | C]** of this repo. Read `AGENTS.md`, `docs/ARCHITECTURE.md`, `docs/DECISIONS.md` and `MILESTONES.md` first, then `git log --oneline` and the code changed since the last checkpoint.

Focus:
- **A:** schema vs. ARCHITECTURE.md, webhook signature + idempotency (`lib/webhooks.ts`, Stripe route), `lib/access.ts` (can any path give access without a valid entitlement?), secrets/env handling, server-only boundaries.
- **B:** grace/recovery/cancel/refund handlers, out-of-order and duplicate events, outbox (rollback-safe? double send? retry/backoff?), n8n HMAC + dedupe, cron auth.
- **C:** everything, plus the README case study's accuracy (does it claim anything the code doesn't do?), the demo account, and the updated application answers and email.

Report only real problems, ranked: what breaks, how to reproduce it, the minimal fix. Then list missing tests. Don't rewrite working code for style.
