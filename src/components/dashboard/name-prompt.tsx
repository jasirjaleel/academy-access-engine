"use client";

import { Loader2, UserRound } from "lucide-react";
import { useActionState } from "react";
import { saveNameAction, type SaveNameState } from "@/app/dashboard/actions";
import { Button } from "@/components/ui/button";

const inputClass =
  "h-11 w-full rounded-xl bg-white/5 px-3 text-white ring-1 ring-white/10 outline-none placeholder:text-slate-500 focus:ring-amber";

/** Shown only when the account has no name yet (e.g. email sign-up without names). */
export function NamePrompt() {
  const [state, action, pending] = useActionState<SaveNameState, FormData>(saveNameAction, undefined);

  return (
    <form
      action={action}
      className="rounded-3xl border border-amber/30 bg-amber/[0.08] p-5 shadow-[0_0_70px_-24px_rgba(237,140,68,0.55)] backdrop-blur-xl sm:p-6"
    >
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-amber/30 bg-amber/15 text-amber">
          <UserRound className="size-5" />
        </div>
        <div>
          <h2 className="font-bold text-white">What should we call you?</h2>
          <p className="text-sm text-slate-300">So we can greet you properly on your dashboard.</p>
        </div>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
        <label className="sr-only" htmlFor="firstName">
          First name
        </label>
        <input id="firstName" name="firstName" placeholder="First name" required autoComplete="given-name" className={inputClass} />
        <label className="sr-only" htmlFor="lastName">
          Last name
        </label>
        <input id="lastName" name="lastName" placeholder="Last name" autoComplete="family-name" className={inputClass} />
        <Button type="submit" disabled={pending} className="h-11 px-6">
          {pending ? <Loader2 className="animate-spin" /> : null}
          Save
        </Button>
      </div>
      {state?.error ? <p className="mt-2 text-sm text-amber-100">{state.error}</p> : null}
    </form>
  );
}
