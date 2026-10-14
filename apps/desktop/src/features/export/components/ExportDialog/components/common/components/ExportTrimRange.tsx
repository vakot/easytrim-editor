import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { useAppDispatch, useAppSelector } from "@/app/store/redux-hooks";
import { selectExportDialogTrim } from "@/app/store/slices/export-slice";
import { selectTrim } from "@/app/store/slices/trim-slice";
import { exportTrimChangedRequested } from "@/app/store/thunks/export-thunks";
import { isValidTrimRange, MIN_SELECTION_MICROS } from "@/domain/trim";

function ExportTrimRange({ onValidityChange }: { onValidityChange: (isValid: boolean) => void }) {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const timelineTrim = useAppSelector(selectTrim);
  const dialogTrim = useAppSelector(selectExportDialogTrim);
  const durationMicros = timelineTrim?.sourceDurationMicros ?? 0;
  const initial = dialogTrim ?? timelineTrim;

  const [start, setStart] = useState(() => secondsInput(initial?.startMicros ?? 0));
  const [end, setEnd] = useState(() => secondsInput(initial?.endMicros ?? durationMicros));
  const isValid = parseRange(start, end, durationMicros) !== null;
  const errorId = "export-trim-range-error";

  useEffect(() => {
    onValidityChange(isValid);
  }, [isValid, onValidityChange]);

  const onRangeChange = (nextStart: string, nextEnd: string) => {
    setStart(nextStart);
    setEnd(nextEnd);
    const range = parseRange(nextStart, nextEnd, durationMicros);
    if (range) void dispatch(exportTrimChangedRequested(range));
  };

  const invalidProps = isValid ? {} : { "aria-describedby": errorId, "aria-invalid": true };
  const max = secondsInput(durationMicros);

  return (
    <section className="grid gap-1.5">
      <Label htmlFor="export-trim-start">{t("export.trimRange.label")}</Label>
      <div className="flex items-center gap-2">
        <Input
          {...invalidProps}
          aria-label={t("export.trimRange.startLabel")}
          className="flex-1"
          id="export-trim-start"
          inputMode="decimal"
          max={max}
          min={0}
          onChange={(event) => onRangeChange(event.target.value, end)}
          placeholder={t("export.trimRange.startLabel")}
          step="any"
          type="number"
          value={start}
        />
        <span aria-hidden="true">–</span>
        <Input
          {...invalidProps}
          aria-label={t("export.trimRange.endLabel")}
          className="flex-1"
          inputMode="decimal"
          max={max}
          min={0}
          onChange={(event) => onRangeChange(start, event.target.value)}
          placeholder={t("export.trimRange.endLabel")}
          step="any"
          type="number"
          value={end}
        />
      </div>
      {!isValid ? (
        <p className="text-sm text-destructive" id={errorId} role="alert">
          {t("export.trimRange.invalidValue", {
            duration: max,
            minimum: secondsInput(Math.min(MIN_SELECTION_MICROS, durationMicros)),
          })}
        </p>
      ) : null}
    </section>
  );
}

function secondsInput(micros: number) {
  return String(micros / 1_000_000);
}

function parseRange(start: string, end: string, sourceDurationMicros: number) {
  if (start.trim() === "" || end.trim() === "") return null;
  const range = {
    startMicros: Math.round(Number(start) * 1_000_000),
    endMicros: Math.round(Number(end) * 1_000_000),
    sourceDurationMicros,
  };

  return isValidTrimRange(range)
    ? { endMicros: range.endMicros, startMicros: range.startMicros }
    : null;
}

export { ExportTrimRange };
