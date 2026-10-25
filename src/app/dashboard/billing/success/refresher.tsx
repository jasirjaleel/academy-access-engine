"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

/** Re-renders the server page every 2s until access appears; gives up after 30s. */
export function Refresher() {
  const router = useRouter();
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    const started = Date.now();
    const id = setInterval(() => {
      if (Date.now() - started > 30_000) {
        clearInterval(id);
        setTimedOut(true);
        return;
      }
      router.refresh();
    }, 2000);
    return () => clearInterval(id);
  }, [router]);

  if (!timedOut) return null;
  return (
    <p className="mt-4 rounded-xl bg-amber/10 p-3 text-sm text-amber-100">
      This is taking longer than usual. Your payment is safe. Refresh in a minute or contact support.
    </p>
  );
}
