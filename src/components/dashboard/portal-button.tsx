"use client";

import { CreditCard, Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export function PortalButton({ label = "Update card", variant = "default" }: { label?: string; variant?: "default" | "secondary" }) {
  const [loading, setLoading] = useState(false);

  async function open() {
    setLoading(true);
    try {
      const res = await fetch("/api/portal", { method: "POST" });
      const data: { url?: string; error?: string } = await res.json();
      if (!res.ok || !data.url) throw new Error(data.error ?? "Couldn't open billing.");
      window.location.href = data.url;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't open billing.");
      setLoading(false);
    }
  }

  return (
    <Button onClick={open} disabled={loading} variant={variant} className="h-11 px-5">
      {loading ? <Loader2 className="animate-spin" /> : <CreditCard className="size-4" />}
      {label}
    </Button>
  );
}
