import { AppShell } from "@/components/app-shell/app-shell";
import { requireAdmin } from "@/lib/auth";

// Admin pages live in the same workspace; their links are in the sidebar's Admin section.
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  return <AppShell>{children}</AppShell>;
}
