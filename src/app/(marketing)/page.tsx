import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 py-16 text-center">
      <main className="mx-auto flex max-w-2xl flex-col items-center gap-6">
        <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl md:text-6xl">
          Demo Academy
        </h1>
        <p className="text-lg text-muted-foreground sm:text-xl">
          Learn Arabic and the Islamic sciences, at your pace.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-4 pt-4">
          <Button asChild size="lg">
            <Link href="/pricing">View plans</Link>
          </Button>
          <Button asChild variant="outline" size="lg">
            <Link href="/dashboard">Student login</Link>
          </Button>
        </div>
      </main>
    </div>
  );
}
