"use client";

import { Loader2, PauseCircle, Percent } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { finishCancellation, getRetentionOffer, keepSubscription } from "@/app/dashboard/billing/actions";
import { Button } from "@/components/ui/button";
import { CANCEL_REASONS, type CancelReason, type RetentionOffer } from "@/lib/cancel-reasons";

type Step = "closed" | "reason" | "offer";

export function CancelFlow({ subscriptionId, planName }: { subscriptionId: string; planName: string }) {
  const [step, setStep] = useState<Step>("closed");
  const [reason, setReason] = useState<CancelReason | null>(null);
  const [comment, setComment] = useState("");
  const [offer, setOffer] = useState<RetentionOffer>(null);
  const [pending, start] = useTransition();
  const router = useRouter();

  const finish = (decision: "accept_offer" | "cancel") =>
    start(async () => {
      try {
        const { message } = await finishCancellation({ subscriptionId, reason: reason!, comment, decision });
        toast.success(message);
        setStep("closed");
        router.refresh();
      } catch {
        toast.error("Something went wrong. Please try again.");
      }
    });

  const next = () =>
    start(async () => {
      if (!reason) return;
      try {
        const o = await getRetentionOffer({ subscriptionId, reason });
        setOffer(o);
        if (o) setStep("offer");
        else finish("cancel");
      } catch {
        toast.error("Something went wrong. Please try again.");
      }
    });

  if (step === "closed") {
    return (
      <button type="button" onClick={() => setStep("reason")} className="text-sm text-slate-400 underline-offset-4 hover:text-white hover:underline">
        Cancel plan
      </button>
    );
  }

  return (
    <div className="mt-3 w-full rounded-2xl bg-white/[0.03] p-4 ring-1 ring-white/10">
      {step === "reason" ? (
        <>
          <p className="font-semibold text-white">Before you go, may we ask why?</p>
          <p className="text-sm text-slate-400">It helps us improve {planName}.</p>
          <div className="mt-3 space-y-2">
            {(Object.keys(CANCEL_REASONS) as CancelReason[]).map((r) => (
              <label key={r} className="flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2 ring-1 ring-white/10 hover:bg-white/5 has-checked:ring-amber">
                <input type="radio" name={`reason-${subscriptionId}`} value={r} checked={reason === r} onChange={() => setReason(r)} className="accent-amber" />
                <span className="text-sm text-slate-200">{CANCEL_REASONS[r]}</span>
              </label>
            ))}
          </div>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            maxLength={500}
            placeholder="Anything else you'd like to tell us? (optional)"
            className="mt-3 w-full rounded-xl bg-white/5 p-3 text-sm text-white ring-1 ring-white/10 outline-none placeholder:text-slate-500 focus:ring-amber"
            rows={2}
          />
          <div className="mt-3 flex flex-wrap gap-2">
            <Button onClick={next} disabled={!reason || pending} variant="secondary">
              {pending ? <Loader2 className="animate-spin" /> : null}
              Continue
            </Button>
            <Button onClick={() => setStep("closed")} variant="ghost" disabled={pending}>
              Never mind
            </Button>
          </div>
        </>
      ) : (
        <>
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-amber/30 bg-amber/15 text-amber">
              {offer === "discount" ? <Percent className="size-5" /> : <PauseCircle className="size-5" />}
            </div>
            <div>
              <p className="font-semibold text-white">
                {offer === "discount" ? "How about 30% off your next payment?" : "Would a break help instead?"}
              </p>
              <p className="text-sm text-slate-300">
                {offer === "discount"
                  ? "Keep learning at a lower price. Nothing else changes."
                  : "Pause billing for 30 days. Your access and progress stay as they are."}
              </p>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button onClick={() => finish("accept_offer")} disabled={pending}>
              {pending ? <Loader2 className="animate-spin" /> : null}
              {offer === "discount" ? "Yes, apply 30% off" : "Yes, pause for 30 days"}
            </Button>
            <Button onClick={() => finish("cancel")} variant="ghost" disabled={pending}>
              No thanks, cancel my plan
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

export function KeepPlanButton({ subscriptionId, label }: { subscriptionId: string; label: string }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <Button
      variant="secondary"
      disabled={pending}
      onClick={() =>
        start(async () => {
          try {
            toast.success((await keepSubscription(subscriptionId)).message);
            router.refresh();
          } catch {
            toast.error("Something went wrong. Please try again.");
          }
        })
      }
    >
      {pending ? <Loader2 className="animate-spin" /> : null}
      {label}
    </Button>
  );
}
