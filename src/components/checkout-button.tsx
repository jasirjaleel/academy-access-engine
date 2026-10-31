"use client";

import { ArrowRight, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { ProductKey } from "@/lib/catalogue";

export function CheckoutButton({
  productKey,
  label,
  variant = "default",
}: {
  productKey: ProductKey;
  label: string;
  variant?: "default" | "secondary";
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function start() {
    setLoading(true);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ productKey }),
      });
      // Signed out: the API says so, and we send them to sign in first.
      if (res.status === 401) {
        router.push("/sign-in?redirect_url=/dashboard/plans");
        return;
      }
      const data: { url?: string; error?: string } = await res.json();
      if (!res.ok || !data.url) throw new Error(data.error ?? "Couldn't start checkout.");
      window.location.href = data.url;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't start checkout.");
      setLoading(false);
    }
  }

  return (
    <Button onClick={start} disabled={loading} variant={variant} size="lg" className="h-12 w-full text-base">
      {loading ? <Loader2 className="animate-spin" /> : null}
      {label}
      {!loading && variant === "default" ? <ArrowRight data-icon="inline-end" /> : null}
    </Button>
  );
}
