import { currentUser } from "@clerk/nextjs/server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { db } from "@/db";
import { getSidebarData, type SidebarData } from "@/lib/sidebar";
import { getOrCreateUser } from "@/lib/users";
import { AppSidebar } from "./app-sidebar";
import { CommandPalette } from "./command-palette";
import { TopBar } from "./top-bar";

const EMPTY: SidebarData = {
  programmes: [],
  continueLesson: null,
  inGrace: false,
};

/**
 * The signed-in workspace around every /dashboard and /admin page.
 * Students get the learning sidebar; admins get an admin-only workspace (no student content).
 */
export async function AppShell({
  mode,
  children,
}: {
  mode: "student" | "admin";
  children: React.ReactNode;
}) {
  const user = await getOrCreateUser(db);
  if (!user) redirect("/sign-in");

  const [clerkUser, cookieStore] = await Promise.all([
    currentUser(),
    cookies(),
  ]);
  const isAdmin = clerkUser?.publicMetadata.role === "admin";
  // Admins only see the admin workspace.
  if (mode === "student" && isAdmin) redirect("/admin");

  const data = mode === "student" ? await getSidebarData(db, user.id) : EMPTY;
  const defaultOpen = cookieStore.get("sidebar_state")?.value !== "false";

  const paid = data.programmes.filter(
    (p) => p.badge === "active" || p.badge === "grace",
  );
  const plan =
    mode === "admin"
      ? "Administrator"
      : paid.length === 0
        ? "No plan yet"
        : paid.length > 1
          ? "All programmes"
          : paid[0].titleEn;

  return (
    <SidebarProvider defaultOpen={defaultOpen}>
      <AppSidebar
        mode={mode}
        data={data}
        user={{ name: user.name, email: user.email, plan }}
      />
      <SidebarInset className="min-w-0 bg-transparent">
        <TopBar data={data} />
        <div className="flex-1 px-4 pb-20 pt-6 sm:px-8 sm:pt-8">
          <div
            className={
              mode === "admin"
                ? "mx-auto w-full max-w-6xl"
                : "mx-auto w-full max-w-5xl"
            }
          >
            {children}
          </div>
        </div>
      </SidebarInset>
      <CommandPalette mode={mode} data={data} />
    </SidebarProvider>
  );
}
