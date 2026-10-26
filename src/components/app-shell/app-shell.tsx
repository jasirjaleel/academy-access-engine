import { currentUser } from "@clerk/nextjs/server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { db } from "@/db";
import { getSidebarData } from "@/lib/sidebar";
import { getOrCreateUser } from "@/lib/users";
import { AppSidebar } from "./app-sidebar";
import { CommandPalette } from "./command-palette";
import { TopBar } from "./top-bar";

/** The signed-in workspace: sidebar + top bar + ⌘K, around every /dashboard and /admin page. */
export async function AppShell({ children }: { children: React.ReactNode }) {
  const user = await getOrCreateUser(db);
  if (!user) redirect("/sign-in");

  const [data, clerkUser, cookieStore] = await Promise.all([getSidebarData(db, user.id), currentUser(), cookies()]);
  const isAdmin = clerkUser?.publicMetadata.role === "admin";
  const defaultOpen = cookieStore.get("sidebar_state")?.value !== "false";

  const paid = data.programmes.filter((p) => p.badge === "active" || p.badge === "grace");
  const plan = paid.length === 0 ? "No plan yet" : paid.length > 1 ? "All programmes" : paid[0].titleEn;

  return (
    <SidebarProvider defaultOpen={defaultOpen}>
      <AppSidebar data={data} isAdmin={isAdmin} user={{ name: user.name, email: user.email, plan }} />
      <SidebarInset className="min-w-0 bg-transparent">
        <TopBar data={data} />
        <div className="flex-1 px-4 pb-20 pt-6 sm:px-8 sm:pt-8">
          <div className="mx-auto w-full max-w-5xl">{children}</div>
        </div>
      </SidebarInset>
      <CommandPalette data={data} isAdmin={isAdmin} />
    </SidebarProvider>
  );
}
