"use client";

import { Loader2, RotateCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { retryOutbox } from "@/app/admin/outbox/actions";
import { Button } from "@/components/ui/button";

export function RetryButton({ target, label = "Retry" }: { target: string; label?: string }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <Button
      size="sm"
      variant="secondary"
      disabled={pending}
      onClick={() =>
        start(async () => {
          try {
            toast.success((await retryOutbox(target)).message);
            router.refresh();
          } catch {
            toast.error("Retry failed.");
          }
        })
      }
    >
      {pending ? <Loader2 className="animate-spin" /> : <RotateCw className="size-3.5" />}
      {label}
    </Button>
  );
}
