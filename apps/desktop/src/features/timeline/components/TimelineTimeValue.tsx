import type { FrameRate } from "@/lib/tauri/media";
import { formatPlaybackTime } from "@/domain/playback";

export function TimelineTimeValue({
  label,
  micros,
  frameRate,
}: {
  label: string;
  micros: number | null;
  frameRate?: FrameRate;
}) {
  return (
    <div className="grid gap-px">
      <dt className="text-[0.625rem] font-bold tracking-[0.08em] text-muted-foreground uppercase">
        {label}
      </dt>
      <dd className="m-0 font-mono text-xs tabular-nums">
        {micros === null ? "00:00:00:00f" : formatPlaybackTime(micros, frameRate)}
      </dd>
    </div>
  );
}
