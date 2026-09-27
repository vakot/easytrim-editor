import { useEffect, useRef } from "react";

import { usePlayback } from "@/app/hooks/usePlayback";
import { amplitudeToMeterLevel, peakAmplitude, smoothMeterLevel } from "@/features/audio";

function StereoAudioMeter() {
  const { audioMeterRef, isPlaying } = usePlayback();
  const leftFillRef = useRef<HTMLDivElement>(null);
  const rightFillRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let leftLevel = 0;
    let rightLevel = 0;
    let previousTime = performance.now();
    let frame = 0;
    const meter = audioMeterRef.current;
    if (!meter) return;
    const leftSamples = new Float32Array(meter.left.fftSize);
    const rightSamples = new Float32Array(meter.right.fftSize);

    const updateFill = (element: HTMLDivElement | null, level: number) => {
      element?.style.setProperty("--meter-level", `${level * 100}%`);
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
      updateFill(leftFillRef.current, leftLevel);
      updateFill(rightFillRef.current, rightLevel);

      if (isPlaying || leftLevel > 0 || rightLevel > 0) {
        frame = requestAnimationFrame(animate);
      }
    };

    if (isPlaying) frame = requestAnimationFrame(animate);
    else {
      updateFill(leftFillRef.current, 0);
      updateFill(rightFillRef.current, 0);
    }

    return () => cancelAnimationFrame(frame);
  }, [audioMeterRef, isPlaying]);

  return (
    <div aria-label="Stereo audio level" className="flex flex-1 flex-col gap-1" role="group">
      <StereoAudioMeterChannel label="Left" ref={leftFillRef}>
        L
      </StereoAudioMeterChannel>
      <StereoAudioMeterChannel label="Right" ref={rightFillRef}>
        R
      </StereoAudioMeterChannel>
    </div>
  );
}

function StereoAudioMeterChannel({
  children,
  label,
  ref,
}: {
  children?: React.ReactNode;
  label: string;
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
