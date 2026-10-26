"use client";

import { AlertTriangle, Search } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Fragment } from "react";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import type { SidebarData } from "@/lib/sidebar";
import { openCommandPalette } from "./command-palette";

type Crumb = { label: string; href?: string };

function crumbsFor(pathname: string, data: SidebarData): Crumb[] {
  const home: Crumb = { label: "Home", href: "/dashboard" };
  if (pathname === "/dashboard") return [{ label: "Home" }];
  if (pathname.startsWith("/dashboard/billing")) return [home, { label: "Billing" }];
  if (pathname.startsWith("/dashboard/plans")) return [home, { label: "Plans & upgrades" }];
  const prog = pathname.match(/^\/dashboard\/programmes\/([^/]+)/);
  if (prog) return [home, { label: data.programmes.find((p) => p.slug === prog[1])?.titleEn ?? "Programme" }];
  const lesson = pathname.match(/^\/dashboard\/lessons\/([^/]+)/);
  if (lesson) {
    const p = data.programmes.find((x) => x.lessons.some((l) => l.id === lesson[1]));
    const l = p?.lessons.find((x) => x.id === lesson[1]);
    return p && l
      ? [home, { label: p.titleEn, href: `/dashboard/programmes/${p.slug}` }, { label: `${l.position}. ${l.titleEn}` }]
      : [home, { label: "Lesson" }];
  }
  if (pathname.startsWith("/admin")) {
    const section = pathname.split("/")[2];
    const name = section ? section[0].toUpperCase() + section.slice(1) : "Overview";
    return [{ label: "Admin", href: "/admin" }, { label: name }];
  }
  return [home];
}

export function TopBar({ data }: { data: SidebarData }) {
  const pathname = usePathname();
  const crumbs = crumbsFor(pathname, data);

  return (
    <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-2 border-b border-white/5 bg-midnight/70 px-3 backdrop-blur-xl sm:px-5">
      <SidebarTrigger className="text-slate-300 hover:text-white" />
      <Separator orientation="vertical" className="mx-1 h-4 bg-white/10" />
      <Breadcrumb className="min-w-0 flex-1">
        <BreadcrumbList className="flex-nowrap">
          {crumbs.map((c, i) => (
            <Fragment key={`${c.label}-${i}`}>
              {i > 0 ? <BreadcrumbSeparator className="text-slate-600" /> : null}
              <BreadcrumbItem className={i < crumbs.length - 1 ? "hidden sm:inline-flex" : "min-w-0"}>
                {c.href && i < crumbs.length - 1 ? (
                  <BreadcrumbLink asChild className="text-slate-400 hover:text-white">
                    <Link href={c.href}>{c.label}</Link>
                  </BreadcrumbLink>
                ) : (
                  <BreadcrumbPage className="truncate font-medium text-white">{c.label}</BreadcrumbPage>
                )}
              </BreadcrumbItem>
            </Fragment>
          ))}
        </BreadcrumbList>
      </Breadcrumb>
      {data.inGrace ? (
        <Link
          href="/dashboard/billing"
          className="hidden items-center gap-1.5 rounded-full border border-amber/40 bg-amber/10 px-3 py-1 text-xs font-semibold text-amber-100 sm:inline-flex"
        >
          <AlertTriangle className="size-3.5 text-amber" /> Payment needed
        </Link>
      ) : null}
      <button
        type="button"
        onClick={openCommandPalette}
        className="inline-flex items-center gap-2 rounded-full bg-white/[0.04] px-3 py-1.5 text-sm text-slate-400 ring-1 ring-white/10 transition hover:text-white"
      >
        <Search className="size-4" />
        <span className="hidden md:inline">Search</span>
        <kbd className="hidden rounded bg-white/10 px-1.5 text-[10px] font-semibold text-slate-300 md:inline">⌘K</kbd>
      </button>
    </header>
  );
}
