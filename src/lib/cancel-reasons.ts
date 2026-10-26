// Pure constants, safe to import from client components.
export const CANCEL_REASONS = {
  too_expensive: "It's too expensive right now",
  no_time: "I don't have time at the moment",
  taking_break: "I'm taking a break",
  not_what_expected: "It's not what I expected",
  other: "Something else",
} as const;
export type CancelReason = keyof typeof CANCEL_REASONS;

export type RetentionOffer = "discount" | "pause" | null;
