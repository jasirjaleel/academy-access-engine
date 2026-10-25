"use client";

import { CheckCircle2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { saveProgressAction } from "./actions";

export function LessonPlayer({
  lessonId,
  videoUrl,
  startAt,
  initiallyCompleted,
}: {
  lessonId: string;
  videoUrl: string;
  startAt: number;
  initiallyCompleted: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [completed, setCompleted] = useState(initiallyCompleted);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const save = (done = false) =>
      saveProgressAction(lessonId, video.currentTime, done).catch(() => {
        /* best effort; next save will retry */
      });

    const onLoaded = () => {
      if (startAt > 0 && startAt < video.duration - 5) video.currentTime = startAt;
    };
    const onPause = () => save();
    const onEnded = () => {
      save(true);
      setCompleted(true);
      toast.success("Lesson completed. Bārak Allāhu fīk.");
    };
    const onHidden = () => {
      if (document.visibilityState === "hidden") save();
    };
    const timer = setInterval(() => {
      if (!video.paused) save();
    }, 15_000);

    video.addEventListener("loadedmetadata", onLoaded);
    video.addEventListener("pause", onPause);
    video.addEventListener("ended", onEnded);
    document.addEventListener("visibilitychange", onHidden);
    return () => {
      clearInterval(timer);
      video.removeEventListener("loadedmetadata", onLoaded);
      video.removeEventListener("pause", onPause);
      video.removeEventListener("ended", onEnded);
      document.removeEventListener("visibilitychange", onHidden);
    };
  }, [lessonId, startAt]);

  async function markComplete() {
    await saveProgressAction(lessonId, videoRef.current?.currentTime ?? 0, true);
    setCompleted(true);
    toast.success("Lesson completed. Bārak Allāhu fīk.");
  }

  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-2xl bg-black shadow-[0_30px_80px_-20px_rgba(0,0,0,0.55)] ring-1 ring-white/10">
        <video ref={videoRef} src={videoUrl} controls playsInline preload="metadata" className="aspect-video w-full" />
      </div>
      <div className="flex justify-end">
        {completed ? (
          <span className="inline-flex items-center gap-2 text-sm font-semibold text-amber">
            <CheckCircle2 className="size-4" /> Completed
          </span>
        ) : (
          <Button onClick={markComplete} variant="secondary">
            <CheckCircle2 className="size-4" /> Mark complete
          </Button>
        )}
      </div>
    </div>
  );
}
