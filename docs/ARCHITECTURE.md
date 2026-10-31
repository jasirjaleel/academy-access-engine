# Architecture

## Catalogue (fixed)
**Programmes** (rows in `programmes`, seeded):
| slug | title | Arabic title | notes |
|---|---|---|---|
| `arabic` | Arabic Programme | البرنامج العربي | paid |
| `precision` | Precision in Knowledge | الدقة في العلم | paid |
| `usool` | Foundations of Knowledge | أصول العلم | **free with any paid access** |

Each programme has 6–8 seeded lessons (title_en, title_ar, duration, a public sample video URL, `position`). Lesson 1 of each programme is `is_preview = true` (visible without access).

**Products → Stripe prices** (mapped in `lib/stripe.ts` from env price IDs):
| product_key | Stripe mode | Price | Grants |
|---|---|---|---|
| `arabic_monthly` | subscription | $30/mo | arabic (+ usool bundle) |
| `precision_monthly` | subscription | $15/mo | precision (+ usool bundle) |
| `lifetime` | payment (one-time) | $999 | arabic + precision + usool, forever |

Regional pricing: a Stripe coupon `REGION40` (40% off, promotion codes enabled at Checkout).

## Tables (`src/db/schema.ts`)
```
users
  id                 text PK            -- Supabase Auth user id (D17)
  email              text not null
  name               text
  stripe_customer_id text unique
  timezone           text default 'UTC'
  whatsapp_phone     text               -- E.164, optional, opt-in
  whatsapp_opt_in    boolean default false
  utm                jsonb              -- first-touch attribution (M8)
  created_at, updated_at timestamptz

programmes   id uuid PK, slug text unique, title_en, title_ar, description, position int
lessons      id uuid PK, programme_id fk, title_en, title_ar, video_url, duration_sec int,
             position int, is_preview bool default false
             UNIQUE (programme_id, position)

subscriptions                        -- mirror of Stripe, written only by webhook handlers
  id                   text PK       -- Stripe subscription id
  user_id              fk users
  product_key          text
  status               text          -- Stripe status: active | past_due | canceled | unpaid | paused | ...
  current_period_end   timestamptz
  cancel_at_period_end boolean
  updated_at

entitlements
  id              uuid PK
  user_id         fk users
  programme_id    fk programmes
  source          enum('subscription','lifetime','bundle','manual')
  source_ref      text not null     -- subscription id | payment_intent id | 'bundle' | 'manual'
                                    -- (NOT NULL on purpose: Postgres treats NULLs as distinct, so a
                                    --  nullable column would let the unique constraint allow duplicates)
  status          enum('active','grace','revoked')
  grace_until     timestamptz null
  revoked_reason  text null         -- 'payment_failed' | 'canceled' | 'refunded' | 'manual'
  created_at, updated_at
  UNIQUE (user_id, programme_id, source, source_ref)

invoices                            -- for dunning + "recovered revenue"
  id             text PK            -- Stripe invoice id
  user_id, subscription_id
  amount_due int, currency text
  status         text               -- open | paid | void | uncollectible
  first_failed_at timestamptz null
  paid_at         timestamptz null
  attempt_count   int

lesson_progress
  user_id, lesson_id   PK (user_id, lesson_id)
  last_position_sec int, completed_at timestamptz null, updated_at

cancellation_feedback
  id uuid PK, user_id, subscription_id, reason text, comment text,
  offer_shown text null, offer_accepted boolean, created_at

processed_events                    -- webhook idempotency + admin log
  id           text PK              -- Stripe event id
  provider     text                 -- 'stripe' (older rows may say 'clerk')
  type         text
  received_at  timestamptz
  result       text                 -- 'applied' | 'ignored' | 'error'
  error        text null

outbound_events                     -- outbox to n8n
  id           uuid PK
  type         text                 -- see Event catalogue
  user_id      fk users
  payload      jsonb                -- ids + minimal fields only
  dedupe_key   text UNIQUE
  status       enum('pending','sent','failed')
  attempts     int default 0
  next_attempt_at timestamptz
  last_error   text null
  created_at, sent_at
```

## Access rule (`lib/access.ts`)
A user can watch a lesson if `lesson.is_preview`, **or** they have an entitlement for its programme where
`status = 'active'` OR (`status = 'grace'` AND `grace_until > now()`).

The `usool` bundle entitlement (`source = 'bundle'`) exists while the user has **any** active or grace paid entitlement. It is recomputed by `syncBundle(db, userId)` after every entitlement change.

## Stripe event → effect
| Event | Effect |
|---|---|
| `checkout.session.completed` (mode=payment, lifetime) | upsert 3 entitlements, source=lifetime, active; enqueue `student.enrolled` |
| `checkout.session.completed` (mode=subscription) | re-fetch the subscription → upsert `subscriptions` + entitlement source=subscription, active; enqueue `student.enrolled` |
| `customer.subscription.updated` | re-fetch → mirror; if `cancel_at_period_end` became true, enqueue `subscription.cancel_scheduled` |
| `invoice.payment_failed` | upsert invoice (`first_failed_at` if empty); entitlement → `grace`, `grace_until = first_failed_at + 7d` (if the event arrives before access was ever granted, the entitlement is created in `grace`); enqueue `payment.failed` (dedupe per invoice + attempt) |
| `invoice.paid` | invoice paid; if it had failed before → entitlement `active`, clear grace, enqueue `payment.recovered` |
| `customer.subscription.deleted` | entitlement `revoked` (reason `canceled`, or `payment_failed` if it was in grace); enqueue `subscription.ended` |
| `charge.refunded` (full refund) | revoke entitlements with that source_ref, reason `refunded` |
| anything else | record in `processed_events` as `ignored` |

After every change, call `syncBundle`. **Every handler runs inside one transaction that also inserts the `processed_events` row** (insert first; on conflict, only re-take the row if its previous `result` was `error`; zero rows returned → duplicate → return early). This is implemented once in `lib/webhooks.ts` → `withIdempotency()`.

Cron `expire-grace` (daily, protected by `CRON_SECRET`): entitlements in `grace` whose `grace_until < now()` → `revoked` (`payment_failed`), then enqueue `access.revoked`.

## Event catalogue (outbox → n8n)
| type | dedupe_key | n8n does |
|---|---|---|
| `student.enrolled` | `enrolled:{userId}:{productKey}` | welcome email + "start lesson 1" |
| `student.inactive_3d` | `inactive3d:{userId}` | nudge (from the daily cron: enrolled ≥3 days, 0 progress) |
| `payment.failed` | `payfail:{invoiceId}:{attempt}` | email with portal link (WhatsApp later, if opted in) |
| `payment.recovered` | `recovered:{invoiceId}` | thank-you email |
| `subscription.cancel_scheduled` | `cancelsched:{subId}` | "sorry to see you go" + offer |
| `subscription.ended` | `ended:{subId}` | win-back after 14 days |
| `access.revoked` | `revoked:{entitlementId}` | final notice |

Dispatch: right after commit (`after()` from `next/server`), POST to `N8N_WEBHOOK_URL` with header `x-signature: HMAC-SHA256(body, N8N_SIGNING_SECRET)`. On failure: `attempts++`, `next_attempt_at` = exponential backoff (5m, 30m, 2h, 12h), and `failed` after 5 attempts. The cron `dispatch-events` retries due rows, and the admin page has a "retry" button. n8n checks the signature and keeps its own dedupe on `dedupe_key`.

## Env vars (`.env.example`)
```
DATABASE_URL=          # Supabase transaction pooler (port 6543), used by the app
DATABASE_URL_DIRECT=   # Supabase session/direct connection (port 5432), used by drizzle-kit migrations
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=
CLERK_WEBHOOK_SIGNING_SECRET=
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=
STRIPE_PRICE_ARABIC_MONTHLY=
STRIPE_PRICE_PRECISION_MONTHLY=
STRIPE_PRICE_LIFETIME=
N8N_WEBHOOK_URL=
N8N_SIGNING_SECRET=
CRON_SECRET=
NEXT_PUBLIC_APP_URL=
GA4_MEASUREMENT_ID=
GA4_API_SECRET=
```

Admin role: Supabase `app_metadata.role === 'admin'` (only the secret key can set it), checked server-side by `requireAdmin()` in `src/app/admin/layout.tsx`, every admin page and every admin server action.
