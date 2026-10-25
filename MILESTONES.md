# Milestones

Deadline: application + cold email go out **Thursday 29 Oct 2026, morning**.
Each task = one Gemini prompt = one commit. Before the next task, Jasir runs the **✅ Check** himself.
Full task prompts live in `tasks/`. Tasks without a prompt file yet get one written before that milestone starts.

**Cut line:** if M6 isn't done by Tuesday night, skip M8. Never skip M4, M5, M9 or M10.

---

## Sunday evening

### M1: Foundation
| Task | What | ✅ Check |
|---|---|---|
| M1.1 | Scaffold Next.js + TS + Tailwind + shadcn; scripts; `.env.example`; `lib/env.ts` | `npm run dev` shows the page; `npm run typecheck` passes |
| M1.2 | Drizzle + Supabase connection; **full schema** from ARCHITECTURE.md; first migration | `npm run db:migrate` creates all tables in Supabase |
| M1.3 | Seed programmes + lessons | `npm run db:seed` twice → still 3 programmes (seed is idempotent) |
| M1.4 | Push to GitHub + deploy on Vercel | Vercel URL opens the landing page |

### M2: Auth
| Task | What | ✅ Check |
|---|---|---|
| M2.1 | Clerk install, middleware protects `/dashboard` + `/admin`, sign-in/up pages, header with UserButton | Logged out, `/dashboard` redirects to sign-in |
| M2.2 | Clerk webhook `user.created`/`user.updated`/`user.deleted` → `users` table, idempotent via `processed_events` | Sign up → row in `users`; resend the event in the Clerk dashboard → no duplicate |
| M2.3 | Admin guard in `admin/layout.tsx` via `publicMetadata.role` | A non-admin gets 404 at `/admin`; after setting role=admin in Clerk, it opens |
| M2.4 | Apply `docs/DESIGN.md`: tokens, Inter + Naskh, background pattern, pill nav, landing hero, dark Clerk pages | Landing and sign-in match the navy/amber look; Inter everywhere; no horizontal scroll at 375 px |

## Monday

### M3: Catalogue + checkout
| Task | What | ✅ Check |
|---|---|---|
| M3.1 | Create Stripe test products/prices + `REGION40` coupon (script `scripts/stripe-setup.ts`); `lib/stripe.ts` price map | Prices visible in the Stripe test dashboard; IDs in `.env.local` |
| M3.2 | Pricing page (3 plans) + `POST /api/checkout` (creates/reuses the Stripe customer, `client_reference_id = userId`, metadata `product_key`) | Card 4242 4242 4242 4242 completes checkout |
| M3.3 | Success/cancel pages | Redirects back correctly |

### M4: Student dashboard + access engine core (the heart)
| Task | What | ✅ Check |
|---|---|---|
| M4.1 | Stripe webhook route: raw body, signature verify, `processed_events` idempotency wrapper, dispatch to `lib/billing/*` | `stripe trigger payment_intent.succeeded` → row with result `ignored` |
| M4.2 | `checkout.session.completed` handlers (lifetime + subscription) + `syncBundle` | After paying, 2 entitlements (programme + usool) or 3 (lifetime) exist |
| M4.3 | `lib/access.ts` + server-side gating on lesson pages | A locked lesson shows the upgrade screen; the preview lesson always plays |
| M4.4 | Dashboard home: programme cards (locked/unlocked + progress %), "continue watching", billing card | Looks premium on mobile + desktop |
| M4.5 | Programme page (lesson list with Arabic titles, RTL `dir="rtl"` spans) + lesson page (video, mark complete, saves position) | Progress persists after reload |
| M4.6 | First tests: Vitest + PGlite setup; duplicate event = no-op; lifetime grants 3 | `npm test` green |

**→ Opus checkpoint A** (`tasks/_opus-review.md`): schema, webhook, access, security.

## Tuesday

### M5: Failed payment + recovery
| Task | What | ✅ Check |
|---|---|---|
| M5.1 | `invoice.payment_failed` → invoice row + entitlement `grace` (7d) | Subscription with card `4000 0000 0000 0341`, then advance a test clock → status grace |
| M5.2 | `invoice.paid` recovery → active; `customer.subscription.deleted` → revoked | Update the card in the portal → access restored |
| M5.3 | `POST /api/portal` (Billing Portal) + dashboard banner "Payment failed: update card by {date}" | Banner shows during grace and disappears after recovery |
| M5.4 | Cron `expire-grace` + `vercel.json` cron + CRON_SECRET | Set grace_until in the past, call the cron → revoked |
| M5.5 | Tests: fail → grace → recover; fail → expire → revoked; out-of-order events | `npm test` green |

### M6: Cancellation + refunds
| Task | What | ✅ Check |
|---|---|---|
| M6.1 | Billing page cancel flow: reason (RHF+Zod) → offer (pause 1 month / 30% off once) → confirm → `cancel_at_period_end` | Each choice is stored in `cancellation_feedback` |
| M6.2 | `charge.refunded` → revoke by source_ref | Refund in the Stripe dashboard → access gone |
| M6.3 | Tests for cancel + refund | `npm test` green |

### M7: Outbox + n8n automations
| Task | What | ✅ Check |
|---|---|---|
| M7.1 | `lib/events.ts`: `enqueueEvent` (in tx), dispatch with HMAC + backoff; cron `dispatch-events` | Kill N8N_WEBHOOK_URL → rows retry with backoff |
| M7.2 | Wire enqueue calls into the handlers (event catalogue) + `inactive_3d` in the daily cron | Each flow creates exactly one outbound row |
| M7.3 | n8n workflow: verify HMAC → dedupe → switch by type → Resend email / WhatsApp Cloud API; quiet hours by user timezone; Error Workflow → alert | The same event posted twice → one email |
| M7.4 | Export workflows to `n8n/` + `n8n/README.md` | JSON imports cleanly into a fresh n8n |

**→ Opus checkpoint B**: reliability and edge cases.

## Wednesday

### M8: Attribution (cut first if behind)
| Task | What | ✅ Check |
|---|---|---|
| M8.1 | Capture UTMs in a first-party cookie → save to `users.utm` on signup → Stripe metadata | UTM link → signup → utm stored |
| M8.2 | GA4 Measurement Protocol `purchase` from the webhook with `transaction_id` = invoice/session id | Event visible in GA4 DebugView |

### M9: Admin + test hardening
| Task | What | ✅ Check |
|---|---|---|
| M9.1 | Admin: failed payments in grace, recovered revenue (30d), webhook log, outbox with retry button, grant/revoke manual entitlement | All numbers match the DB |
| M9.2 | GitHub Actions: lint + typecheck + test | Green badge |
| M9.3 | Fill test gaps that the Opus reviews pointed out | `npm test` green |

### M10: Packaging
| Task | What | ✅ Check |
|---|---|---|
| M10.1 | Dashboard polish pass (empty states, loading skeletons, mobile) | Feels finished on a phone |
| M10.2 | Demo account (seeded, with progress + a failed-payment state) | Login works in a private window |
| M10.3 | README case study: problem → diagram → decisions → tests → "what I built vs. what AI assisted" | A stranger understands it in 2 minutes |
| M10.4 | Record the 3-min Loom: subscribe → fail → grace → recover → replay ignored | Shows results, not just code |

**→ Opus checkpoint C**: code, README, form answers, email.

## Thursday morning
Open every link in a private window → submit the form → send the email.
