"use client";

import {
  BookOpen,
  CreditCard,
  Home,
  LayoutDashboard,
  Lock,
  PlayCircle,
  Sparkles,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import type { SidebarData } from "@/lib/sidebar";

const OPEN_EVENT = "academy:open-command-palette";
export const openCommandPalette = () =>
  window.dispatchEvent(new Event(OPEN_EVENT));

/** ⌘K / Ctrl+K: jump to any page, programme or lesson. */
export function CommandPalette({
  data,
  isAdmin,
}: {
  data: SidebarData;
  isAdmin: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  // Start fresh every time the palette opens.
  const toggle = (next: boolean) => {
    setOpen(next);
    if (!next) setQuery("");
  };
  const router = useRouter();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((o) => {
          if (o) setQuery("");
          return !o;
        });
      }
    };
    const onOpen = () => setOpen(true);
    window.addEventListener("keydown", onKey);
    window.addEventListener(OPEN_EVENT, onOpen);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener(OPEN_EVENT, onOpen);
    };
  }, []);

  const go = (href: string) => {
    toggle(false);
    router.push(href);
  };

  return (
    <CommandDialog
      open={open}
      onOpenChange={toggle}
      title="Search"
      description="Jump to a lesson or page"
      className="bg-midnight-2 ring-1 ring-white/10"
    >
      <Command className="bg-transparent">
        <CommandInput value={query} onValueChange={setQuery} placeholder="Search lessons, programmes, pages…" />
        <CommandList>
          <CommandEmpty>Nothing found.</CommandEmpty>
          <CommandGroup heading="Go to">
            <CommandItem onSelect={() => go("/dashboard")}>
              <Home /> Home
            </CommandItem>
            {data.continueLesson ? (
              <CommandItem
                onSelect={() =>
                  go(`/dashboard/lessons/${data.continueLesson!.id}`)
                }
              >
                <PlayCircle className="text-amber" /> Continue:{" "}
                {data.continueLesson.titleEn}
              </CommandItem>
            ) : null}
            <CommandItem onSelect={() => go("/dashboard/billing")}>
              <CreditCard /> Billing
            </CommandItem>
            <CommandItem onSelect={() => go("/dashboard/plans")}>
              <Sparkles /> Plans &amp; upgrades
            </CommandItem>
            {isAdmin ? (
              <CommandItem onSelect={() => go("/admin")}>
                <LayoutDashboard /> Admin overview
              </CommandItem>
            ) : null}
          </CommandGroup>
          {data.programmes.map((p) => (
            <CommandGroup key={p.slug} heading={p.titleEn}>
              <CommandItem
                value={`${p.titleEn} ${p.titleAr} programme`}
                onSelect={() => go(`/dashboard/programmes/${p.slug}`)}
              >
                <BookOpen /> {p.titleEn}{" "}
                <span className="ml-auto font-arabic text-slate-400" dir="rtl">
                  {p.titleAr}
                </span>
              </CommandItem>
              {p.lessons.map((l) => (
                <CommandItem
                  key={l.id}
                  value={`${l.titleEn} ${l.titleAr} ${p.titleEn}`}
                  onSelect={() => go(`/dashboard/lessons/${l.id}`)}
                >
                  {l.state === "locked" ? (
                    <Lock className="text-slate-500" />
                  ) : (
                    <PlayCircle />
                  )}
                  <span
                    className={
                      l.state === "locked" ? "text-slate-500" : undefined
                    }
                  >
                    {l.position}. {l.titleEn}
                  </span>
                  <span
                    className="ml-auto font-arabic text-slate-400"
                    dir="rtl"
                  >
                    {l.titleAr}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          ))}
        </CommandList>
      </Command>
    </CommandDialog>
  );
}
