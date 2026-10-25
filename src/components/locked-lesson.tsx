import { Lock } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

/** Rendered instead of the player. Never receives the video URL. */
export function LockedLesson({ programmeTitle }: { programmeTitle: string }) {
  return (
    <div className="flex aspect-video w-full flex-col items-center justify-center rounded-2xl bg-gradient-to-br from-teal to-midnight p-6 text-center ring-1 ring-white/10">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-white/5 text-slate-300 ring-1 ring-white/10">
        <Lock className="size-6" />
      </div>
      <h2 className="mt-4 text-xl font-bold text-white">This lesson is part of {programmeTitle}</h2>
      <p className="mt-2 max-w-md text-slate-300">Unlock the programme to keep learning. The first lesson is always free to preview.</p>
      <Button asChild className="mt-5 h-11 px-6">
        <Link href="/pricing">See plans</Link>
      </Button>
    </div>
  );
}
