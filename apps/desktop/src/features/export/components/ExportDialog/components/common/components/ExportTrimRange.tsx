import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Label } from "@/components/ui/label";

import { useAppDispatch, useAppSelector } from "@/app/store/redux-hooks";
import { selectExportDialogTrim } from "@/app/store/slices/export-slice";
import { selectSourceMedia } from "@/app/store/slices/source-slice";
import { selectTrim } from "@/app/store/slices/trim-slice";
import { exportTrimChangedRequested } from "@/app/store/thunks/export-thunks";
import { frameCountFor } from "@/domain/media-time";
import { createTrimFrameAdapter } from "@/domain/trim-frames";

const DEFAULT_FRAME_RATE = { numerator: 30, denominator: 1 };

function ExportTrimRange({ onValidityChange }: { onValidityChange: (isValid: boolean) => void }) {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const media = useAppSelector(selectSourceMedia);
  const timelineTrim = useAppSelector(selectTrim);
  const dialogTrim = useAppSelector(selectExportDialogTrim);
  const durationMicros = timelineTrim?.sourceDurationMicros ?? 0;
  // Match the Timeline's frame grid so the same frame numbers address the same timestamps.
  const frameRate =
    media?.video.averageFrameRate ?? media?.video.realFrameRate ?? DEFAULT_FRAME_RATE;

  const metadataFrameCount = media?.video.frameCount;
  const framesCount =
    metadataFrameCount && metadataFrameCount > 0
      ? metadataFrameCount
      : frameCountFor(durationMicros, frameRate);

  const adapter = createTrimFrameAdapter(durationMicros, framesCount, frameRate);

  const [initial] = useState(() =>
    adapter.fromTrim({
      startMicros: 0,
      endMicros: durationMicros,
      ...(dialogTrim ?? timelineTrim),
      sourceDurationMicros: durationMicros,
    }),
  );

  const [start, setStart] = useState(String(initial.start));
  const [end, setEnd] = useState(String(initial.end));
  const isValid = parseFrames(start, end) !== null;
  const errorId = "export-trim-range-error";

  useEffect(() => {
    onValidityChange(isValid);
  }, [isValid, onValidityChange]);

  function parseFrames(nextStart: string, nextEnd: string) {
    if (!/^\d+$/.test(nextStart.trim()) || !/^\d+$/.test(nextEnd.trim())) return null;
    const range = { start: Number(nextStart), end: Number(nextEnd) };
    return range.end <= framesCount && range.end >= adapter.bounds(range).minEnd ? range : null;
  }

  const onRangeChange = (nextStart: string, nextEnd: string) => {
    setStart(nextStart);
    setEnd(nextEnd);
    const range = parseFrames(nextStart, nextEnd);
    if (!range) return;
    const { endMicros, startMicros } = adapter.toTrim(range);
    void dispatch(exportTrimChangedRequested({ endMicros, startMicros }));
  };

  const invalidProps = isValid ? {} : { "aria-describedby": errorId, "aria-invalid": true };

  return (
    <section className="grid gap-1.5">
      <Label htmlFor="export-trim-start">{t("export.trimRange.label")}</Label>
      <div className="flex items-center gap-2">
        <InputGroup className="flex-1">
          <InputGroupInput
            {...invalidProps}
            aria-label={t("export.trimRange.startLabel")}
            id="export-trim-start"
            inputMode="numeric"
            max={framesCount}
            min={0}
            onChange={(event) => onRangeChange(event.target.value, end)}
            placeholder={t("export.trimRange.startLabel")}
            step={1}
            type="number"
            value={start}
          />
          <InputGroupAddon className="text-muted-foreground">f</InputGroupAddon>
        </InputGroup>
        <span aria-hidden="true">–</span>
        <InputGroup className="flex-1">
          <InputGroupInput
            {...invalidProps}
            aria-label={t("export.trimRange.endLabel")}
            inputMode="numeric"
            max={framesCount}
            min={0}
            onChange={(event) => onRangeChange(start, event.target.value)}
            placeholder={t("export.trimRange.endLabel")}
            step={1}
            type="number"
            value={end}
          />
          <InputGroupAddon className="text-muted-foreground">f</InputGroupAddon>
        </InputGroup>
      </div>
      {!isValid ? (
        <p className="text-sm text-destructive" id={errorId} role="alert">
          {t("export.trimRange.invalidValue", {
            frames: framesCount,
            minimum: adapter.bounds({ start: 0, end: framesCount }).minEnd,
          })}
        </p>
      ) : null}
    </section>
  );
}

export { ExportTrimRange };
