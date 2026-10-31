import "server-only";
import { z } from "zod";

const envSchema = z
  .object({
    DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
    DATABASE_URL_DIRECT: z.string().optional(),
    NEXT_PUBLIC_SUPABASE_URL: z.string().min(1, "NEXT_PUBLIC_SUPABASE_URL is required"),
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(1, "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY is required"),
    SUPABASE_SECRET_KEY: z.string().min(1, "SUPABASE_SECRET_KEY is required"), // server only
    STRIPE_SECRET_KEY: z.string().optional(),
    STRIPE_WEBHOOK_SECRET: z.string().optional(),
    NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: z.string().optional(),
    STRIPE_PRICE_ARABIC_MONTHLY: z.string().optional(),
    STRIPE_PRICE_PRECISION_MONTHLY: z.string().optional(),
    STRIPE_PRICE_LIFETIME: z.string().optional(),
    N8N_WEBHOOK_URL: z.string().optional(),
    N8N_SIGNING_SECRET: z.string().optional(),
    CRON_SECRET: z.string().optional(),
    NEXT_PUBLIC_APP_URL: z.string().min(1, "NEXT_PUBLIC_APP_URL is required"),
    GA4_MEASUREMENT_ID: z.string().optional(),
    GA4_API_SECRET: z.string().optional(),
    VERCEL: z.string().optional(), // set by Vercel on every deployment
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),
  })
  .refine(
    (data) => {
      if (data.STRIPE_SECRET_KEY && !data.STRIPE_SECRET_KEY.startsWith("sk_test_")) {
        return false;
      }
      return true;
    },
    {
      message: "Live Stripe keys are not allowed in this project",
      path: ["STRIPE_SECRET_KEY"],
    }
  );

export type Env = z.infer<typeof envSchema>;

export const env = envSchema.parse(process.env);
