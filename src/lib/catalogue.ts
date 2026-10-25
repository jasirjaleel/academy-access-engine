// Pure catalogue definitions (no env, no Stripe client) so billing logic stays testable.

export const PRODUCT_KEYS = ["arabic_monthly", "precision_monthly", "lifetime"] as const;
export type ProductKey = (typeof PRODUCT_KEYS)[number];

export type PaidProgrammeSlug = "arabic" | "precision";
export type ProgrammeSlug = PaidProgrammeSlug | "usool";

/** Free with any paid access (source = 'bundle'). */
export const BUNDLE_PROGRAMME: ProgrammeSlug = "usool";

export const PRODUCTS: Record<
  ProductKey,
  {
    name: string;
    mode: "subscription" | "payment";
    amountCents: number;
    programmes: PaidProgrammeSlug[];
  }
> = {
  arabic_monthly: {
    name: "Arabic Programme (monthly)",
    mode: "subscription",
    amountCents: 3000,
    programmes: ["arabic"],
  },
  precision_monthly: {
    name: "Precision in Knowledge (monthly)",
    mode: "subscription",
    amountCents: 1500,
    programmes: ["precision"],
  },
  lifetime: {
    name: "Lifetime Access",
    mode: "payment",
    amountCents: 99900,
    programmes: ["arabic", "precision"],
  },
};

export function isProductKey(value: unknown): value is ProductKey {
  return typeof value === "string" && (PRODUCT_KEYS as readonly string[]).includes(value);
}
