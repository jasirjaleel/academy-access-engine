import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

const createdAt = () =>
  timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
const updatedAt = () =>
  timestamp("updated_at", { withTimezone: true }).notNull().defaultNow();

export const entitlementSource = pgEnum("entitlement_source", [
  "subscription",
  "lifetime",
  "bundle",
  "manual",
]);
export const entitlementStatus = pgEnum("entitlement_status", [
  "active",
  "grace",
  "revoked",
]);
export const outboundStatus = pgEnum("outbound_status", [
  "pending",
  "sent",
  "failed",
]);

export const users = pgTable("users", {
  id: text("id").primaryKey(), // Clerk user id
  email: text("email").notNull(),
  name: text("name"),
  stripeCustomerId: text("stripe_customer_id").unique(),
  timezone: text("timezone").notNull().default("UTC"),
  whatsappPhone: text("whatsapp_phone"),
  whatsappOptIn: boolean("whatsapp_opt_in").notNull().default(false),
  utm: jsonb("utm"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const programmes = pgTable("programmes", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: text("slug").notNull().unique(),
  titleEn: text("title_en").notNull(),
  titleAr: text("title_ar").notNull(),
  description: text("description").notNull(),
  position: integer("position").notNull(),
});

export const lessons = pgTable(
  "lessons",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    programmeId: uuid("programme_id")
      .notNull()
      .references(() => programmes.id, { onDelete: "restrict" }),
    titleEn: text("title_en").notNull(),
    titleAr: text("title_ar").notNull(),
    videoUrl: text("video_url").notNull(),
    durationSec: integer("duration_sec").notNull(),
    position: integer("position").notNull(),
    isPreview: boolean("is_preview").notNull().default(false),
  },
  (t) => [unique("lessons_programme_position_unique").on(t.programmeId, t.position)],
);

// Mirror of Stripe; written only by webhook handlers.
export const subscriptions = pgTable("subscriptions", {
  id: text("id").primaryKey(), // Stripe subscription id
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "restrict" }),
  productKey: text("product_key").notNull(),
  status: text("status").notNull(),
  currentPeriodEnd: timestamp("current_period_end", { withTimezone: true }),
  cancelAtPeriodEnd: boolean("cancel_at_period_end").notNull().default(false),
  pausedUntil: timestamp("paused_until", { withTimezone: true }),
  updatedAt: updatedAt(),
});

export const entitlements = pgTable(
  "entitlements",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    programmeId: uuid("programme_id")
      .notNull()
      .references(() => programmes.id, { onDelete: "restrict" }),
    source: entitlementSource("source").notNull(),
    // Not null on purpose: Postgres treats NULLs as distinct in unique constraints.
    sourceRef: text("source_ref").notNull(),
    status: entitlementStatus("status").notNull(),
    graceUntil: timestamp("grace_until", { withTimezone: true }),
    revokedReason: text("revoked_reason"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    unique("entitlements_user_programme_source_ref_unique").on(
      t.userId,
      t.programmeId,
      t.source,
      t.sourceRef,
    ),
    index("entitlements_user_id_idx").on(t.userId),
  ],
);

export const invoices = pgTable(
  "invoices",
  {
    id: text("id").primaryKey(), // Stripe invoice id
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    subscriptionId: text("subscription_id").references(() => subscriptions.id, {
      onDelete: "restrict",
    }),
    amountDue: integer("amount_due").notNull(),
    currency: text("currency").notNull(),
    status: text("status").notNull(),
    firstFailedAt: timestamp("first_failed_at", { withTimezone: true }),
    paidAt: timestamp("paid_at", { withTimezone: true }),
    attemptCount: integer("attempt_count").notNull().default(0),
  },
  (t) => [index("invoices_user_id_idx").on(t.userId)],
);

export const lessonProgress = pgTable(
  "lesson_progress",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    lessonId: uuid("lesson_id")
      .notNull()
      .references(() => lessons.id, { onDelete: "restrict" }),
    lastPositionSec: integer("last_position_sec").notNull().default(0),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    updatedAt: updatedAt(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.lessonId] })],
);

export const cancellationFeedback = pgTable("cancellation_feedback", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  subscriptionId: text("subscription_id").notNull(),
  reason: text("reason").notNull(),
  comment: text("comment"),
  offerShown: text("offer_shown"),
  offerAccepted: boolean("offer_accepted").notNull().default(false),
  createdAt: createdAt(),
});

// Webhook idempotency + admin log.
export const processedEvents = pgTable("processed_events", {
  id: text("id").primaryKey(), // Stripe / Clerk event id
  provider: text("provider").notNull(),
  type: text("type").notNull(),
  receivedAt: timestamp("received_at", { withTimezone: true }).notNull().defaultNow(),
  result: text("result").notNull(), // 'applied' | 'ignored' | 'error'
  error: text("error"),
});

// Outbox to n8n.
export const outboundEvents = pgTable(
  "outbound_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    type: text("type").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    payload: jsonb("payload").notNull(),
    dedupeKey: text("dedupe_key").notNull().unique(),
    status: outboundStatus("status").notNull().default("pending"),
    attempts: integer("attempts").notNull().default(0),
    nextAttemptAt: timestamp("next_attempt_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    lastError: text("last_error"),
    createdAt: createdAt(),
    sentAt: timestamp("sent_at", { withTimezone: true }),
  },
  (t) => [index("outbound_events_status_next_attempt_idx").on(t.status, t.nextAttemptAt)],
);

export type User = typeof users.$inferSelect;
export type Programme = typeof programmes.$inferSelect;
export type Lesson = typeof lessons.$inferSelect;
export type Subscription = typeof subscriptions.$inferSelect;
export type Entitlement = typeof entitlements.$inferSelect;
export type Invoice = typeof invoices.$inferSelect;
export type LessonProgress = typeof lessonProgress.$inferSelect;
export type CancellationFeedback = typeof cancellationFeedback.$inferSelect;
export type ProcessedEvent = typeof processedEvents.$inferSelect;
export type OutboundEvent = typeof outboundEvents.$inferSelect;
