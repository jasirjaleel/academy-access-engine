"use client";

import { Loader2 } from "lucide-react";
import Link from "next/link";
import { useActionState } from "react";
import { signInAction, signUpAction, type AuthState } from "@/app/(marketing)/auth-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

function Field({ label, ...props }: { label: string } & React.ComponentProps<typeof Input>) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm font-medium text-slate-200">{label}</span>
      <Input {...props} className="h-11 bg-white/[0.04] text-white ring-1 ring-white/10" />
    </label>
  );
}

export function AuthForm({ mode, next }: { mode: "sign-in" | "sign-up"; next?: string }) {
  const [state, action, pending] = useActionState<AuthState, FormData>(
    mode === "sign-in" ? signInAction : signUpAction,
    undefined,
  );
  const signUp = mode === "sign-up";
  const other = signUp ? "/sign-in" : "/sign-up";
  const otherHref = next ? `${other}?redirect_url=${encodeURIComponent(next)}` : other;

  return (
    <div className="w-full max-w-sm rounded-3xl bg-midnight-2/90 p-8 ring-1 ring-white/10 backdrop-blur">
      <h1 className="text-center text-xl font-bold text-white">
        {signUp ? "Create your account" : "Sign in to Demo Academy"}
      </h1>
      <p className="mt-1 text-center text-sm text-slate-400">
        {signUp ? "Start with the free Foundations programme." : "Welcome back! Please sign in to continue."}
      </p>

      <form action={action} className="mt-6 space-y-4">
        <input type="hidden" name="next" value={next ?? "/dashboard"} />
        {signUp ? <Field label="Your name" name="name" autoComplete="name" required /> : null}
        <Field
          label="Email"
          name="email"
          type="email"
          autoComplete="email"
          defaultValue={state?.email}
          required
        />
        <Field
          label="Password"
          name="password"
          type="password"
          autoComplete={signUp ? "new-password" : "current-password"}
          minLength={signUp ? 8 : undefined}
          required
        />
        {state?.error ? (
          <p role="alert" className="rounded-xl bg-red-500/10 px-3 py-2 text-sm text-red-300 ring-1 ring-red-500/30">
            {state.error}
          </p>
        ) : null}
        <Button type="submit" size="lg" disabled={pending} className="h-11 w-full">
          {pending ? <Loader2 className="animate-spin" /> : null}
          {signUp ? "Create account" : "Sign in"}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-slate-400">
        {signUp ? "Already have an account?" : "Don't have an account?"}{" "}
        <Link href={otherHref} className="font-semibold text-amber hover:underline">
          {signUp ? "Sign in" : "Sign up"}
        </Link>
      </p>
    </div>
  );
}
