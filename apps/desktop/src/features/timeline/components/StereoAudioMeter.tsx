import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";

import { usePlayback } from "@/app/hooks/usePlayback";
import {
  amplitudeToMeterLevel,
  meterZoneLevels,
  peakAmplitude,
  smoothMeterLevel,
  updatePeakHold,
} from "@/features/audio";
import { cn } from "@/lib/class-names.utils";

const METER_MARKERS = [
  { level: 0, label: "−60 dBFS" },
  { level: 10, label: "−54 dBFS" },
  { level: 20, label: "−48 dBFS" },
  { level: 30, label: "−42 dBFS" },
  { level: 40, label: "−36 dBFS" },
  { level: 50, label: "−30 dBFS" },
  { level: 60, label: "−24 dBFS" },
  { level: 70, label: "−18 dBFS" },
  { level: 80, label: "−12 dBFS" },
  { level: 90, label: "−6 dBFS" },
  { level: 100, label: "0 dBFS" },
];

const METER_MARKER_LABELS = [
  { level: 0, label: "−60" },
  { level: 20, label: "−48" },
  { level: 40, label: "−36" },
  { level: 60, label: "−24" },
  { level: 80, label: "−12" },
  { level: 100, label: "0" },
];

function StereoAudioMeter() {
  const { audioMeterRef, isPlaying } = usePlayback();
  const { t } = useTranslation();
  const leftFillRef = useRef<HTMLDivElement>(null);
  const rightFillRef = useRef<HTMLDivElement>(null);
  const leftPeakRef = useRef<HTMLDivElement>(null);
  const rightPeakRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let leftLevel = 0;
    let rightLevel = 0;
    let leftPeakHold = { level: 0, holdRemainingMs: 0 };
    let rightPeakHold = { level: 0, holdRemainingMs: 0 };
    let previousTime = performance.now();
    let frame = 0;
    const meter = audioMeterRef.current;
    const updateFill = (element: HTMLDivElement | null, level: number) => {
      if (!element) return;
      const zones = meterZoneLevels(level);
      element.style.setProperty("--meter-safe-level", `${zones.safe * 100}%`);
      element.style.setProperty("--meter-warning-level", `${zones.warning * 100}%`);
      element.style.setProperty("--meter-clipping-level", `${zones.clipping * 100}%`);
    };

    const updatePeak = (element: HTMLDivElement | null, level: number) => {
      if (!element) return;
      element.style.left = `${level * 100}%`;
      element.hidden = level === 0;
    };

    if (!meter) {
      updateFill(leftFillRef.current, 0);
      updateFill(rightFillRef.current, 0);
      updatePeak(leftPeakRef.current, 0);
      updatePeak(rightPeakRef.current, 0);
      return;
    }
    const leftSamples = new Float32Array(meter.left.fftSize);
    const rightSamples = new Float32Array(meter.right.fftSize);

    const animate = (time: number) => {
      const elapsed = Math.max(0, time - previousTime);
      previousTime = time;

      let leftTarget = 0;
      let rightTarget = 0;
      if (isPlaying) {
        meter.left.getFloatTimeDomainData(leftSamples);
        meter.right.getFloatTimeDomainData(rightSamples);
        const leftPeak = peakAmplitude(leftSamples);
        const rightPeak = meter.isMono ? leftPeak : peakAmplitude(rightSamples);
        leftTarget = amplitudeToMeterLevel(leftPeak);
        rightTarget = amplitudeToMeterLevel(rightPeak);
      }

      leftLevel = smoothMeterLevel(leftLevel, leftTarget, elapsed);
      rightLevel = smoothMeterLevel(rightLevel, rightTarget, elapsed);
      leftPeakHold = updatePeakHold(leftPeakHold, leftLevel, elapsed);
      rightPeakHold = updatePeakHold(rightPeakHold, rightLevel, elapsed);
      updateFill(leftFillRef.current, leftLevel);
      updateFill(rightFillRef.current, rightLevel);
      updatePeak(leftPeakRef.current, leftPeakHold.level);
      updatePeak(rightPeakRef.current, rightPeakHold.level);

      if (isPlaying || leftLevel > 0 || rightLevel > 0) {
        frame = requestAnimationFrame(animate);
      }
    };

    if (isPlaying) frame = requestAnimationFrame(animate);
    else {
      updateFill(leftFillRef.current, 0);
      updateFill(rightFillRef.current, 0);
      updatePeak(leftPeakRef.current, 0);
      updatePeak(rightPeakRef.current, 0);
    }

    return () => cancelAnimationFrame(frame);
  }, [audioMeterRef, isPlaying]);

  return (
    <div
      aria-label={t("timeline.accessibility.audioLevel")}
      className="flex w-full flex-col"
      role="group"
    >
      <StereoAudioMeterScale />
      <div className="relative flex flex-1 flex-col gap-1">
        <StereoAudioMeterChannel
          label={t("timeline.accessibility.leftAudioChannelLevel")}
          peakRef={leftPeakRef}
          ref={leftFillRef}
        >
          L
        </StereoAudioMeterChannel>
        <StereoAudioMeterChannel
          label={t("timeline.accessibility.rightAudioChannelLevel")}
          peakRef={rightPeakRef}
          ref={rightFillRef}
        >
          R
        </StereoAudioMeterChannel>
      </div>
    </div>
  );
}

function StereoAudioMeterScale() {
  return (
    <div aria-hidden="true" className="relative h-3 text-[8px] leading-3 text-muted-foreground">
      {METER_MARKER_LABELS.map(({ label, level }) => (
        <span
          className={`absolute top-0 whitespace-nowrap ${
            level === 0 ? "translate-x-0" : level === 100 ? "-translate-x-full" : "-translate-x-1/2"
          }`}
          key={level}
          style={{ left: `${level}%` }}
        >
          {label}
        </span>
      ))}
    </div>
  );
}

function StereoAudioMeterChannel({
  children,
  label,
  peakRef,
  ref,
}: {
  children?: React.ReactNode;
  label: string;
  peakRef: React.RefObject<HTMLDivElement | null>;
  ref: React.RefObject<HTMLDivElement | null>;
}) {
  return (
    <div
      aria-label={`${label} channel audio level`}
      className="relative flex flex-1 overflow-hidden rounded-md bg-secondary p-0.75"
      role="img"
    >
      <div className="relative flex flex-1 items-center overflow-hidden rounded-sm">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#14532d_0%,#14532d_66.6667%,#713f12_66.6667%,#713f12_85%,#7f1d1d_85%,#7f1d1d_100%)]" />
        <div className="absolute inset-0" ref={ref}>
          <div className="absolute inset-y-0 left-0 w-(--meter-safe-level) bg-green-500" />
          <div className="absolute inset-y-0 left-[66.6667%] w-(--meter-warning-level) bg-orange-500" />
          <div className="absolute inset-y-0 left-[85%] w-(--meter-clipping-level) bg-red-500" />
        </div>

        {METER_MARKERS.map(({ label: markerLabel, level }) => (
          <span
            aria-hidden="true"
            className={cn(
              "pointer-events-none absolute inset-y-0 z-10 w-px -translate-x-1/2",
              level > 0 && level < 100 && "bg-muted-foreground/30",
            )}
            key={level}
            style={{ left: `${level}%` }}
            title={markerLabel}
          />
        ))}

        <div
          aria-hidden="true"
          className="absolute top-0 z-20 h-1 w-2 -translate-x-1/2 rounded-b-sm bg-foreground shadow-sm"
          hidden
          ref={peakRef}
        />
        <span
          aria-hidden="true"
          className="relative z-10 px-1 text-[10px] leading-none text-shadow-accent"
        >
          {children}
        </span>
      </div>
    </div>
  );
}

export { StereoAudioMeter };
