import { useEffect, useRef } from "react";

import { usePlayback } from "@/app/hooks/usePlayback";
import {
  amplitudeToMeterLevel,
  peakAmplitude,
  smoothMeterLevel,
  updatePeakHold,
} from "@/features/audio";

const METER_MARKERS = [
  { level: 0, label: "−60 dBFS" },
  { level: 20, label: "−48 dBFS" },
  { level: 40, label: "−36 dBFS" },
  { level: 60, label: "−24 dBFS" },
  { level: 70, label: "−18 dBFS" },
  { level: 80, label: "−12 dBFS" },
  { level: 90, label: "−6 dBFS" },
  { level: 100, label: "0 dBFS" },
];

function StereoAudioMeter() {
  const { audioMeterRef, isPlaying } = usePlayback();
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
    if (!meter) return;
    const leftSamples = new Float32Array(meter.left.fftSize);
    const rightSamples = new Float32Array(meter.right.fftSize);

    const updateFill = (element: HTMLDivElement | null, level: number) => {
      element?.style.setProperty("--meter-level", `${level * 100}%`);
    };

    const updatePeak = (element: HTMLDivElement | null, level: number) => {
      if (!element) return;
      element.style.left = `${level * 100}%`;
      element.hidden = level === 0;
    };

    const animate = (time: number) => {
      const elapsed = Math.max(0, time - previousTime);
      previousTime = time;

      let leftTarget = 0;
      let rightTarget = 0;
      if (isPlaying) {
        meter.left.getFloatTimeDomainData(leftSamples);
        meter.right.getFloatTimeDomainData(rightSamples);
        const leftPeak = peakAmplitude(leftSamples);
        let rightPeak = peakAmplitude(rightSamples);
        if (rightPeak < 0.00001 && leftPeak >= 0.00001) rightPeak = leftPeak;
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
    <div aria-label="Stereo audio level" className="flex flex-1 flex-col gap-1" role="group">
      <StereoAudioMeterChannel label="Left" peakRef={leftPeakRef} ref={leftFillRef}>
        L
      </StereoAudioMeterChannel>
      <StereoAudioMeterChannel label="Right" peakRef={rightPeakRef} ref={rightFillRef}>
        R
      </StereoAudioMeterChannel>
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
      className="flex flex-1 rounded-md bg-secondary p-1"
      role="img"
    >
      <div className="relative flex flex-1 items-center overflow-hidden rounded-sm">
        <div
          className="absolute inset-y-0 left-0 w-(--meter-level) bg-[linear-gradient(to_right,#22c55e_0%,#22c55e_70%,#eab308_70%,#eab308_90%,#ef4444_90%,#ef4444_100%)]"
          ref={ref}
        />
        {METER_MARKERS.map(({ label: markerLabel, level }) => (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 z-10 w-px -translate-x-1/2 bg-background/35"
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
