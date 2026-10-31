"use client";

import { Menu, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { cn } from "@/lib/utils";

const links = [
  { href: "/pricing", label: "Pricing" },
  { href: "/dashboard", label: "Dashboard" },
];

function Logo() {
  return (
    <Link href="/" className="inline-flex items-center gap-2 font-bold tracking-tight text-white">
      <span className="h-2.5 w-2.5 rounded-full bg-amber shadow-[0_0_12px_rgba(237,140,68,0.8)]" />
      Demo Academy
    </Link>
  );
}

function AuthControls({ signedIn }: { signedIn: boolean }) {
  return (
    <Link
      href={signedIn ? "/dashboard" : "/sign-in"}
      className="inline-block rounded-full bg-midnight px-4 py-2 text-sm font-semibold text-white ring-1 ring-amber/60 transition hover:ring-amber"
    >
      {signedIn ? "Go to app" : "Sign in"}
    </Link>
  );
}

export function SiteHeader({ signedIn }: { signedIn: boolean }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 px-4 pt-4 sm:px-6 sm:pt-6">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
        <Logo />

        <nav className="hidden items-center rounded-full bg-midnight/70 px-2 py-1.5 ring-1 ring-white/10 backdrop-blur sm:flex">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={cn(
                "rounded-full px-4 py-2 text-sm font-medium text-slate-300 transition hover:text-white",
                pathname.startsWith(l.href) && "bg-white/5 text-white",
              )}
            >
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="hidden sm:block">
          <AuthControls signedIn={signedIn} />
        </div>

        <div className="flex items-center gap-3 sm:hidden">
          <button
            type="button"
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
            className="rounded-full p-2 text-slate-200 ring-1 ring-white/10"
          >
            {open ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </div>
      </div>

      {open && (
        <nav className="mx-auto mt-3 flex max-w-6xl flex-col gap-1 rounded-2xl bg-midnight-2/95 p-2 ring-1 ring-white/10 backdrop-blur sm:hidden">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              onClick={() => setOpen(false)}
              className="rounded-xl px-4 py-3 text-slate-200 hover:bg-white/5"
            >
              {l.label}
            </Link>
          ))}
          <div className="px-2 py-2">
            <AuthControls signedIn={signedIn} />
          </div>
        </nav>
      )}
    </header>
  );
}
