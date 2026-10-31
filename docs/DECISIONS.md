# Decisions log

Add one entry for every non-obvious choice: what, why, and what was rejected. This becomes the README case study.

---

### D1: Entitlements table, separate from Stripe state
**What:** access is decided by our own `entitlements` rows, not by asking Stripe on each page view.
**Why:** it's fast, works if Stripe is slow, supports non-Stripe access (lifetime, bundle, manual grants), and gives an audit trail of why a student has access.
**Rejected:** checking `subscription.status` live on each request.

### D2: Webhook idempotency in the same transaction
**What:** insert the event ID into `processed_events` in the same DB transaction as its effects; a duplicate insert → return 200 and stop.
**Why:** Stripe delivers at least once and retries. A separate "check, then process" step has a race window, and a transaction closes it.

### D3: Re-fetch subscriptions instead of trusting event order
**What:** subscription handlers call `stripe.subscriptions.retrieve()` and write the current state.
**Why:** Stripe doesn't guarantee event order; an older `updated` event arriving late must not overwrite newer state.

### D4: 7-day grace period on failed payment
**What:** after a failed renewal, the student keeps access for 7 days while reminders go out.
**Why:** most failed payments are expired cards, not intent to leave. Cutting access at once punishes loyal students and hurts recovery.

### D5: Outbox for every message
**What:** handlers write to `outbound_events` with a unique `dedupe_key`; dispatch happens after commit, with retries.
**Why:** a message is never sent for a change that rolled back, never sent twice, and never lost if n8n is down.

### D6: Daily crons
**What:** `expire-grace` and the `dispatch-events` retry sweep run daily (the Vercel Hobby limit); the first dispatch happens right after commit.
**Why:** good enough for a demo; in production, these would run every few minutes.

### D7: Test mode only
**What:** `lib/env.ts` refuses `sk_live_` keys.
**Why:** a portfolio deployment must never be able to charge a real card.

### D10: Cache Components off
**What:** `cacheComponents` (and `partialPrefetching`) are disabled in `next.config.ts`.
**Why:** every dashboard page is personal to the student (auth + entitlements), so component caching adds Suspense requirements with no benefit for this app.

### D8: Anonymise on user deletion
**What:** when a student is deleted, personal fields (email, name, WhatsApp) are wiped but the row stays (`anonymizeUser` in `src/lib/users.ts`).
**Status:** this used to run on Clerk's `user.deleted` webhook. Supabase Auth (D17) has no such webhook, so nothing triggers it yet; production needs an admin "delete student" action (or a Supabase auth hook) that calls it.
**Why:** billing and invoice history must stay consistent, while the student's personal data is removed.

### D9: Product comes from the price ID, not from metadata
**What:** subscription handlers map `items[0].price.id` → product key. Lifetime metadata is verified against the checkout mode.
**Why:** metadata is set by our own server, but the price is what Stripe actually charged. An unknown price throws, so a config mistake is loud and retryable instead of silently granting the wrong thing.

### D11: Pure billing handlers, injected Stripe
**What:** `lib/billing/*` never imports the Stripe client; it gets `BillingDeps` (`retrieveSubscription`, `productKeyFromPriceId`, `now`). The route passes `liveDeps`; tests pass fakes.
**Why:** the payment logic runs in tests against a real Postgres (PGlite + real migrations) with no network, so the tricky cases (duplicates, stale payloads, bundle removal) are proven, not hoped for.

### D12: Row Level Security on, no policies
**What:** RLS is enabled on every table (migration `0001_enable_rls`).
**Why:** Supabase exposes `public` tables through its auto-generated Data API. The app connects as the table owner (bypasses RLS), so this blocks the API without affecting the app.

### D13: Grace counts from the first failure; portal can't cancel
**What:** the 7-day grace starts at the invoice's first failed attempt; Stripe's retries send new reminders but don't extend it. The Stripe Billing Portal allows card updates and invoices only.
**Why:** retries shouldn't quietly give extra free weeks. Cancelling goes through our own flow (M6), which records the reason and can offer a pause first.

### D14: Refunds revoke what they paid for
**What:** a full refund of a one-time (lifetime) payment revokes the entitlements whose `source_ref` is that payment intent; the bundle follows. Partial refunds change nothing. Subscription refunds are done by cancelling in Stripe, which arrives as `customer.subscription.deleted`.
**Why:** access must match money actually kept, but a goodwill partial refund shouldn't lock a student out. Other access (e.g. a separate subscription) is untouched.

### D15: Session pooler for the app, plus connection timeouts
**What:** `DATABASE_URL` uses Supabase's session pooler (5432). The client recycles idle (20 s) and old (10 min) connections.
**Why:** while testing M6 locally, page renders hung with Postgres sessions "active / ClientRead" (the database waiting for the app mid-query) on the transaction pooler, while a server action, a router refresh and a webhook transaction overlapped. On the session pooler, repeated cancel/keep/pause cycles ran cleanly. Its limit (15 clients) did bite once: a demo seed advanced 18 Stripe test clocks, the webhook burst spun up several Vercel instances with 5 connections each, and new connections were refused. So each Vercel instance now uses one connection (`max: 1`), and the seed holds at most two.

### D16: Outbox → signed webhook → n8n, de-duplicated on both sides
**What:** the app sends each outbox row to one n8n webhook, signed with HMAC-SHA256 over `timestamp.body`, right after the response (`after()`) and again from a daily cron. Rows are claimed with `FOR UPDATE SKIP LOCKED` and a 2-minute lease; failures back off 5m → 30m → 2h → 12h and stop after 5 attempts. n8n rejects bad or stale signatures, remembers each `dedupeKey` for 30 days, and sends email (Resend). WhatsApp was dropped for now because Meta charges for business-initiated messages. Workflow failures trigger a separate error-alert workflow.
**Why:** the app owns *what happened* (reliably, inside the same transaction as the change); n8n owns *how to tell the student*, so the copy and channels can change without a deploy. The workflows need no server settings (the secret sits in n8n's Crypto node, the Resend key is an n8n credential), so they can run on a shared n8n instance without a restart. Delivery is at-least-once, so both sides de-duplicate. Personal data is added at send time and never stored in the outbox.

### D17: Supabase Auth instead of Clerk
**What:** login is email + password on Supabase Auth (`@supabase/ssr`, cookie sessions refreshed in `src/proxy.ts`). Our `users` row is created on the first signed-in page load (`getOrCreateUser`), so no auth webhook is needed. Admins have `app_metadata.role = "admin"`, which only the secret key can set. Email confirmation is off for now. Every server check uses `auth.getUser()`, which asks Supabase to verify the session rather than trusting the cookie.
**Why:** one system for logins and data, no third-party user store to keep in step, and demo accounts can be created from a script (`auth.admin.createUser`). The browser only ever gets the publishable key, and RLS with no policies (D12) means that key can't read our tables. `user_metadata` is editable by the user, so it is never used for roles.

### D18: Demo data is real Stripe test-mode history
**What:** `scripts/seed-demo.ts` gives each demo student a Stripe test clock starting on their join date, a customer, a card and a subscription or a lifetime invoice, then advances the clock to now. Stripe bills the renewals, declines Maryam's renewal, recovers one failed payment after a card change, schedules a cancellation and refunds one lifetime buyer. The script then reads those events back from Stripe and runs each one through the same handlers and idempotency guard as the webhook, so it doesn't depend on delivery timing; the webhook's own copies arrive later and are skipped as duplicates. Lifetime access is granted through `handleCheckoutCompleted`, because a script can't click through Checkout. Afterwards the script copies Stripe's own timestamps onto the mirrored rows.
**Why:** the admin dashboard and the Stripe dashboard must tell the same story. Writing payments straight into the database looked fine until someone compared the two. Stripe deletes test clocks after about 30 days, so the seed is re-run before a demo.

