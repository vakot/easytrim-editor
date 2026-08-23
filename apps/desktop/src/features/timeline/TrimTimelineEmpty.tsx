import { useState, type CSSProperties } from "react";
import { useTranslation } from "react-i18next";

import { PlaybackControls, TimelineTools } from "@/features/preview/PlaybackControls";
import {
  DEFAULT_PLAYBACK_SPEED,
  type PlaybackSpeed,
} from "@/features/editor/hooks/usePlaybackSpeed";
import { TrimHandle } from "./components/TimelineHandles";
import styles from "./components/styles.module.css";

const EMPTY_VALUE = "---";
const EMPTY_TIMELINE_STYLE = {
  "--timeline-trim-start": "0%",
  "--timeline-trim-end": "100%",
  "--timeline-trim-end-inset": "0%",
  "--timeline-trim-center": "50%",
} as CSSProperties;

export function TrimTimelineEmpty() {
  const { t } = useTranslation();
  const [safeTrimFollowingEnabled, setSafeTrimFollowingEnabled] = useState(false);
  const [loopPlaybackEnabled, setLoopPlaybackEnabled] = useState(false);
  const [segmentPlaybackEnabled, setSegmentPlaybackEnabled] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<PlaybackSpeed>(DEFAULT_PLAYBACK_SPEED);

  const resetTools = () => {
    setSafeTrimFollowingEnabled(false);
    setLoopPlaybackEnabled(false);
    setSegmentPlaybackEnabled(false);
    setPlaybackSpeed(DEFAULT_PLAYBACK_SPEED);
  };

  return (
    <section className="min-w-0 select-none bg-background" aria-labelledby="timeline-title">
      <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-6">
        <div className="min-w-0 justify-self-start">
          <h2
            id="timeline-title"
            className="mb-0.5 font-heading text-xs font-bold tracking-[0.16em] text-primary uppercase"
          >
            {t("timeline.selectedSegment")}
          </h2>
          <output
            className="font-mono text-xs text-muted-foreground"
            aria-label={t("preview.currentTime")}
          >
            {EMPTY_VALUE}
            <span aria-hidden="true"> / {EMPTY_VALUE}</span>
          </output>
        </div>
        <PlaybackControls
          disabled
          isPlaying={false}
          error={null}
          canSetSegmentStart={false}
          canSetSegmentEnd={false}
          onTogglePlayback={() => undefined}
          onStepFrame={() => undefined}
          onSetSegmentBoundary={() => undefined}
        />
        <dl className="m-0 flex justify-self-end gap-5" aria-label={t("timeline.trimValues")}>
          <EmptyTimelineTimeValue label={t("timeline.start")} />
          <EmptyTimelineTimeValue label={t("timeline.end")} />
          <EmptyTimelineTimeValue label={t("timeline.duration")} />
        </dl>
      </div>

      <div
        className="mt-3 mb-1 grid min-w-0 grid-cols-[var(--editor-track-grid-columns)] items-end gap-3"
        aria-hidden="true"
      >
        <span
          className="text-[0.625rem] font-bold tracking-[0.08em] text-muted-foreground uppercase"
          data-slot="timeline-tools-title"
        >
          {t("timeline.tools")}
        </span>
        <div className="flex justify-between font-mono text-[0.625rem] text-muted-foreground">
          {[0, 1, 2, 3, 4].map((value) => (
            <span key={value}>{EMPTY_VALUE}</span>
          ))}
        </div>
      </div>

      <div
        className="grid min-w-0 grid-cols-[var(--editor-track-grid-columns)] items-center gap-3"
        data-slot="timeline-row"
      >
        <div
          className="flex w-full items-stretch"
          data-slot="timeline-toolbar"
          role="toolbar"
          aria-label={t("timeline.toolsLabel")}
        >
          <TimelineTools
            safeTrimFollowingEnabled={safeTrimFollowingEnabled}
            loopPlaybackEnabled={loopPlaybackEnabled}
            segmentPlaybackEnabled={segmentPlaybackEnabled}
            playbackSpeed={playbackSpeed}
            onToggleSafeTrimFollowing={() => setSafeTrimFollowingEnabled(!safeTrimFollowingEnabled)}
            onToggleLoopPlayback={() => setLoopPlaybackEnabled(!loopPlaybackEnabled)}
            onToggleSegmentPlayback={() => setSegmentPlaybackEnabled(!segmentPlaybackEnabled)}
            onPlaybackSpeedChange={setPlaybackSpeed}
            onReset={resetTools}
          />
        </div>
        <div
          className={styles.track}
          style={EMPTY_TIMELINE_STYLE}
          aria-label={t("timeline.trackLabel")}
          aria-description={t("import.emptyStage.timelinePlaceholder")}
          aria-disabled="true"
        >
          <div
            className={styles.selection}
            style={{ left: "var(--timeline-trim-start)", right: "var(--timeline-trim-end-inset)" }}
          />
          <TrimHandle
            boundary="start"
            value={0}
            minimum={0}
            maximum={0}
            dragging={false}
            snapActive={false}
            disabled
            onPointerDown={() => undefined}
            onPointerMove={() => undefined}
            onPointerEnd={() => undefined}
            onDoubleClick={() => undefined}
            onKeyDown={() => undefined}
          />
          <TrimHandle
            boundary="end"
            value={0}
            minimum={0}
            maximum={0}
            dragging={false}
            snapActive={false}
            disabled
            onPointerDown={() => undefined}
            onPointerMove={() => undefined}
            onPointerEnd={() => undefined}
            onDoubleClick={() => undefined}
            onKeyDown={() => undefined}
          />
        </div>
      </div>
    </section>
  );
}

function EmptyTimelineTimeValue({ label }: { label: string }) {
  return (
    <div className="grid gap-px">
      <dt className="text-[0.625rem] font-bold tracking-[0.08em] text-muted-foreground uppercase">
        {label}
      </dt>
      <dd className="m-0 font-mono text-xs tabular-nums">{EMPTY_VALUE}</dd>
    </div>
  );
}
