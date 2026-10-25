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
**What:** on Clerk `user.deleted`, personal fields (email, name, WhatsApp) are wiped but the row stays.
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
