"use client";

import {
  Activity,
  BookOpen,
  CheckCircle2,
  ChevronRight,
  CircleDot,
  CreditCard,
  Gift,
  Home,
  LayoutDashboard,
  LogOut,
  Lock,
  PlayCircle,
  Search,
  Send,
  Sparkles,
  Wallet,
  Users,
  Webhook,
} from "lucide-react";
import Link from "next/link";
import { signOutAction } from "@/app/(marketing)/auth-actions";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar";
import type { LessonState, ProgrammeBadge, SidebarData } from "@/lib/sidebar";
import { cn } from "@/lib/utils";
import { openCommandPalette } from "./command-palette";

const activeGlow =
  "data-[active=true]:bg-amber/10 data-[active=true]:text-white data-[active=true]:shadow-[inset_2px_0_0_#ED8C44,0_0_24px_-12px_rgba(237,140,68,0.6)]";

const badgeStyle: Record<ProgrammeBadge, string> = {
  active: "text-amber",
  grace: "text-amber-200",
  free: "text-dusk",
  locked: "text-slate-500",
};
const badgeText: Record<ProgrammeBadge, string> = {
  active: "Active",
  grace: "Due",
  free: "Free",
  locked: "",
};

function LessonIcon({ state }: { state: LessonState }) {
  if (state === "done") return <CheckCircle2 className="text-amber" />;
  if (state === "in_progress") return <CircleDot className="text-dusk" />;
  if (state === "locked") return <Lock className="text-slate-500" />;
  return <PlayCircle className="text-slate-400" />;
}

export function AppSidebar({
  mode,
  data,
  user,
}: {
  mode: "student" | "admin";
  data: SidebarData;
  user: { name: string | null; email: string; plan: string };
}) {
  const pathname = usePathname();
  const { setOpenMobile } = useSidebar();

  // Close the mobile drawer after navigating.
  useEffect(() => setOpenMobile(false), [pathname, setOpenMobile]);

  const is = (href: string) => pathname === href;
  const within = (prefix: string) => pathname.startsWith(prefix);

  return (
    <Sidebar collapsible="icon" className="border-r border-white/10">
      <SidebarHeader className="gap-3 pt-4">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild size="lg" tooltip="Demo Academy">
              <Link href={mode === "admin" ? "/admin" : "/dashboard"}>
                <span className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-amber/15 ring-1 ring-amber/40">
                  <span className="size-2.5 rounded-full bg-amber shadow-[0_0_12px_rgba(237,140,68,0.9)]" />
                </span>
                <span className="flex flex-col leading-tight">
                  <span className="font-bold tracking-tight text-white">
                    Demo Academy
                  </span>
                  <span className="text-xs text-slate-400">
                    {mode === "admin" ? "Admin console" : "Student workspace"}
                  </span>
                </span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              tooltip="Search (⌘K)"
              onClick={openCommandPalette}
              className="bg-white/[0.04] text-slate-400 ring-1 ring-white/10 hover:text-white"
            >
              <Search />
              <span>{mode === "admin" ? "Search…" : "Search lessons…"}</span>
              <kbd className="ml-auto rounded bg-white/10 px-1.5 text-[10px] font-semibold text-slate-300">
                ⌘K
              </kbd>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        {mode === "student" ? (
          <>
            <SidebarGroup>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    asChild
                    isActive={is("/dashboard")}
                    tooltip="Home"
                    className={activeGlow}
                  >
                    <Link href="/dashboard">
                      <Home />
                      <span>Home</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                {data.continueLesson ? (
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      asChild
                      tooltip="Continue learning"
                      className={activeGlow}
                    >
                      <Link
                        href={`/dashboard/lessons/${data.continueLesson.id}`}
                      >
                        <PlayCircle className="text-amber" />
                        <span className="truncate">
                          Continue: {data.continueLesson.titleEn}
                        </span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ) : null}
              </SidebarMenu>
            </SidebarGroup>

            <SidebarGroup>
              <SidebarGroupLabel className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">
                Programmes
              </SidebarGroupLabel>
              <SidebarMenu>
                {data.programmes.map((p) => {
                  const href = `/dashboard/programmes/${p.slug}`;
                  const open =
                    within(href) ||
                    p.lessons.some((l) => is(`/dashboard/lessons/${l.id}`));
                  const Icon = p.slug === "usool" ? Gift : BookOpen;
                  return (
                    <Collapsible
                      key={p.slug}
                      asChild
                      defaultOpen={open || p.badge === "active"}
                      className="group/collapsible"
                    >
                      <SidebarMenuItem>
                        <SidebarMenuButton
                          asChild
                          isActive={is(href)}
                          tooltip={p.titleEn}
                          className={cn(activeGlow, "pr-[4.5rem]!")}
                        >
                          <Link href={href}>
                            <Icon
                              className={
                                p.badge === "locked"
                                  ? "text-slate-500"
                                  : "text-amber"
                              }
                            />
                            <span className="truncate">{p.titleEn}</span>
                          </Link>
                        </SidebarMenuButton>
                        {p.badge !== "locked" ? (
                          <SidebarMenuBadge
                            className={cn(
                              "right-7 text-[10px] font-bold uppercase",
                              badgeStyle[p.badge],
                            )}
                          >
                            {badgeText[p.badge]}
                          </SidebarMenuBadge>
                        ) : (
                          <SidebarMenuBadge className="right-7">
                            <Lock className="size-3 text-slate-500" />
                          </SidebarMenuBadge>
                        )}
                        <CollapsibleTrigger asChild>
                          <SidebarMenuAction className="transition-transform group-data-[state=open]/collapsible:rotate-90">
                            <ChevronRight />
                            <span className="sr-only">Toggle lessons</span>
                          </SidebarMenuAction>
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          <SidebarMenuSub className="border-white/10">
                            {p.lessons.map((l) => (
                              <SidebarMenuSubItem key={l.id}>
                                <SidebarMenuSubButton
                                  asChild
                                  isActive={is(`/dashboard/lessons/${l.id}`)}
                                  className={cn(
                                    activeGlow,
                                    l.state === "locked" && "text-slate-500",
                                  )}
                                >
                                  <Link
                                    href={`/dashboard/lessons/${l.id}`}
                                    title={`${l.titleEn} · ${l.titleAr}`}
                                  >
                                    <LessonIcon state={l.state} />
                                    <span className="truncate">
                                      {l.position}. {l.titleEn}
                                    </span>
                                  </Link>
                                </SidebarMenuSubButton>
                              </SidebarMenuSubItem>
                            ))}
                          </SidebarMenuSub>
                        </CollapsibleContent>
                      </SidebarMenuItem>
                    </Collapsible>
                  );
                })}
              </SidebarMenu>
            </SidebarGroup>

            <SidebarGroup>
              <SidebarGroupLabel className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">
                Account
              </SidebarGroupLabel>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    asChild
                    isActive={within("/dashboard/billing")}
                    tooltip="Billing"
                    className={activeGlow}
                  >
                    <Link href="/dashboard/billing">
                      <CreditCard />
                      <span>Billing</span>
                    </Link>
                  </SidebarMenuButton>
                  {data.inGrace ? (
                    <SidebarMenuBadge>
                      <span
                        className="size-2 rounded-full bg-red-400 shadow-[0_0_10px_rgba(248,113,113,0.9)]"
                        aria-label="Payment problem"
                      />
                    </SidebarMenuBadge>
                  ) : null}
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    asChild
                    isActive={is("/dashboard/plans")}
                    tooltip="Plans"
                    className={activeGlow}
                  >
                    <Link href="/dashboard/plans">
                      <Sparkles />
                      <span>Plans &amp; upgrades</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroup>
          </>
        ) : (
          <SidebarGroup>
            <SidebarGroupLabel className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">
              Console
            </SidebarGroupLabel>
            <SidebarMenu>
              {[
                { href: "/admin", label: "Overview", icon: LayoutDashboard },
                { href: "/admin/students", label: "Students", icon: Users },
                { href: "/admin/payments", label: "Payments", icon: Wallet },
                { href: "/admin/webhooks", label: "Webhooks", icon: Webhook },
                { href: "/admin/outbox", label: "Messages", icon: Send },
              ].map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton
                    asChild
                    isActive={is(item.href)}
                    tooltip={item.label}
                    className={activeGlow}
                  >
                    <Link href={item.href}>
                      <item.icon />
                      <span>{item.label}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter className="border-t border-white/10 pb-4">
        <SidebarMenu>
          <SidebarMenuItem>
            <div className="flex items-center gap-3 rounded-xl px-2 py-1.5 group-data-[collapsible=icon]:px-0">
              <span className="grid size-8 shrink-0 place-items-center rounded-full bg-amber/15 text-xs font-bold text-amber ring-1 ring-amber/30">
                {(user.name ?? user.email)
                  .split(/[\s@]/)
                  .filter(Boolean)
                  .map((w) => w[0])
                  .slice(0, 2)
                  .join("")
                  .toUpperCase()}
              </span>
              <div className="min-w-0 flex-1 group-data-[collapsible=icon]:hidden">
                <p className="truncate text-sm font-semibold text-white">
                  {user.name ?? "Student"}
                </p>
                <p className="flex items-center gap-1 truncate text-xs text-slate-400">
                  <Activity className="size-3 text-amber" /> {user.plan}
                </p>
              </div>
              <form action={signOutAction} className="group-data-[collapsible=icon]:hidden">
                <button
                  type="submit"
                  aria-label="Sign out"
                  title="Sign out"
                  className="rounded-lg p-1.5 text-slate-400 transition hover:bg-white/5 hover:text-white"
                >
                  <LogOut className="size-4" />
                </button>
              </form>
            </div>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
