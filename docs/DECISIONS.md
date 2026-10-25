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
