import { redirect } from "next/navigation";
import { db } from "@/db";
import { getOrCreateUser } from "@/lib/users";

// Placeholder until the real dashboard in M4.4.
export default async function DashboardPage() {
  const user = await getOrCreateUser(db);
  if (!user) redirect("/sign-in");

  const firstName = user.name?.split(" ")[0] ?? "student";

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-12 sm:px-6">
      <p className="text-xs font-black uppercase tracking-[0.18em] text-amber">Dashboard</p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight text-white sm:text-4xl">
        Assalāmu ʿalaykum, {firstName}
      </h1>
      <p className="mt-3 text-slate-400">Your programmes will appear here.</p>
    </div>
  );
}
