import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { useAppDispatch, useAppSelector } from "@/app/store/redux-hooks";
import { selectExportDialogTrim } from "@/app/store/slices/export-slice";
import { selectFrameIndex } from "@/app/store/slices/source-slice";
import { selectTrim } from "@/app/store/slices/trim-slice";
import { exportTrimChangedRequested } from "@/app/store/thunks/export-thunks";
import { FrameRangeInput, type FrameRangeInputValue } from "@/components/frame-range-input";
import { createTrimFrameAdapter } from "@/domain/trim-frames";

function ExportTrimRange({ onValidityChange }: { onValidityChange: (isValid: boolean) => void }) {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const frameIndex = useAppSelector(selectFrameIndex);
  const timelineTrim = useAppSelector(selectTrim);
  const dialogTrim = useAppSelector(selectExportDialogTrim);
  // The Timeline's frames, so the same frame numbers address the same real frames.
  const adapter = createTrimFrameAdapter(frameIndex);
  const durationMicros = frameIndex.endMicros;

  const [initial] = useState(() =>
    adapter.fromTrim({
      startMicros: 0,
      endMicros: durationMicros,
      ...(dialogTrim ?? timelineTrim),
      sourceDurationMicros: durationMicros,
    }),
  );

  const [value, setValue] = useState<FrameRangeInputValue>({
    end: String(initial.end),
    start: String(initial.start),
  });

  const isValid = adapter.parse(value.start, value.end) !== null;

  useEffect(() => {
    onValidityChange(isValid);
  }, [isValid, onValidityChange]);

  const onValueChange = (next: FrameRangeInputValue) => {
    setValue(next);
    const range = adapter.parse(next.start, next.end);
    if (!range) return;
    const { endMicros, startMicros } = adapter.toTrim(range);
    void dispatch(exportTrimChangedRequested({ endMicros, startMicros }));
  };

  return (
    <FrameRangeInput
      endLabel={t("export.trimRange.endLabel")}
      error={
        isValid
          ? undefined
          : t("export.trimRange.invalidValue", {
              frames: adapter.lastFrame,
              minimum: adapter.bounds({ start: 0, end: adapter.lastFrame }).minEnd,
            })
      }
      id="export-trim-start"
      label={t("export.trimRange.label")}
      maxFrame={adapter.lastFrame}
      onValueChange={onValueChange}
      startLabel={t("export.trimRange.startLabel")}
      value={value}
    />
  );
}

export { ExportTrimRange };
