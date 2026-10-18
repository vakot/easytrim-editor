import { useState } from "react";
import { useTranslation } from "react-i18next";

import { Switch } from "@/components/ui/switch";

import {
  type AudioSyncOffset,
  type AudioSyncOffsetRange,
  isAudioSyncOffsetWithinRange,
} from "@/domain/audio-processing";

import { AudioParameterSliderInput } from "../components/AudioParameterSliderInput";
import { useAudioFiltersDraft } from "../contexts/audio-filters-draft-context";

const MICROS_PER_MILLISECOND = 1_000;

function toMilliseconds(offsetMicros: number): number {
  return Math.sign(offsetMicros) * Math.round(Math.abs(offsetMicros) / MICROS_PER_MILLISECOND);
}

function formatOffset(offsetMicros: number): string {
  const sign = offsetMicros < 0 ? "−" : "+";
  const absoluteMicros = Math.abs(offsetMicros);
  const totalMilliseconds = Math.round(absoluteMicros / MICROS_PER_MILLISECOND);
  const minutes = Math.floor(totalMilliseconds / 60_000);
  const seconds = Math.floor((totalMilliseconds % 60_000) / 1_000);
  const milliseconds = totalMilliseconds % 1_000;
  return `${sign}${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}.${String(milliseconds).padStart(3, "0")}`;
}

function parseOffset(value: string): number | null {
  const match = /^([+-]|−)?(\d{2,}):(\d{2})\.(\d{3})$/.exec(value.trim());
  if (!match) return null;
  const [, sign, minutesText, secondsText, millisecondsText] = match;
  const minutes = Number(minutesText);
  const seconds = Number(secondsText);
  if (seconds > 59) return null;
  const magnitude = ((minutes * 60 + seconds) * 1_000 + Number(millisecondsText)) * 1_000;
  return sign === "-" || sign === "−" ? -magnitude : magnitude;
}

function SyncOffsetFilterPage({
  offset,
  range,
}: {
  offset: AudioSyncOffset;
  range: AudioSyncOffsetRange;
}) {
  const { t } = useTranslation();
  const { dispatch } = useAudioFiltersDraft();
  // The input and slider use millisecond precision, so keep their endpoints
  // inside the exact media bounds on that representable millisecond grid.
  const editableRange = {
    minOffsetMicros:
      Math.ceil(range.minOffsetMicros / MICROS_PER_MILLISECOND) * MICROS_PER_MILLISECOND,
    maxOffsetMicros:
      Math.floor(range.maxOffsetMicros / MICROS_PER_MILLISECOND) * MICROS_PER_MILLISECOND,
  };

  const displayOffsetMicros = Math.max(
    editableRange.minOffsetMicros,
    Math.min(
      editableRange.maxOffsetMicros,
      toMilliseconds(offset.offsetMicros) * MICROS_PER_MILLISECOND,
    ),
  );

  const [input, setInput] = useState(() => ({
    offsetMicros: offset.offsetMicros,
    text: formatOffset(displayOffsetMicros),
  }));

  const inputValue = Object.is(input.offsetMicros, offset.offsetMicros)
    ? input.text
    : formatOffset(displayOffsetMicros);

  const parsedInput = parseOffset(inputValue);
  const inputInvalid =
    parsedInput === null ||
    !isAudioSyncOffsetWithinRange(parsedInput, editableRange) ||
    !isAudioSyncOffsetWithinRange(offset.offsetMicros, range);

  const span = editableRange.maxOffsetMicros - editableRange.minOffsetMicros;
  const includesDefault = editableRange.minOffsetMicros <= 0 && editableRange.maxOffsetMicros >= 0;
  const toPercentage = (offsetMicros: number) =>
    span <= 0
      ? 50
      : Math.max(0, Math.min(100, ((offsetMicros - editableRange.minOffsetMicros) / span) * 100));

  const percentage = Number.isSafeInteger(offset.offsetMicros)
    ? toPercentage(displayOffsetMicros)
    : 0;

  const updateOffset = (offsetMicros: number, syncInput = false) => {
    if (syncInput) setInput({ offsetMicros, text: formatOffset(offsetMicros) });
    dispatch({ syncOffset: { ...offset, offsetMicros }, type: "syncOffsetUpdated" });
  };

  const updateInput = (value: string) => {
    const parsed = parseOffset(value);
    if (parsed !== null) {
      setInput({ offsetMicros: parsed, text: value });
      updateOffset(parsed);
      return;
    }

    const invalidOffsetMicros = Number.NaN;
    setInput({ offsetMicros: invalidOffsetMicros, text: value });
    updateOffset(invalidOffsetMicros);
  };

  return (
    <div className="grid gap-4" data-slot="audio-filter-page">
      <div className="flex items-center justify-between gap-3 border-b pb-3">
        <div>
          <h3 className="font-semibold">{t("audio.syncOffset.label")}</h3>
          <p className="mt-1 text-sm text-muted-foreground">{t("audio.syncOffset.description")}</p>
        </div>
        <Switch
          aria-label={t("audio.filters.enabled")}
          checked={offset.enabled}
          onCheckedChange={(enabled) =>
            dispatch({ syncOffset: { ...offset, enabled }, type: "syncOffsetUpdated" })
          }
        />
      </div>

      <AudioParameterSliderInput
        disabled={span <= 0}
        error={
          inputInvalid
            ? t("audio.syncOffset.range", {
                max: formatOffset(editableRange.maxOffsetMicros),
                min: formatOffset(editableRange.minOffsetMicros),
              })
            : undefined
        }
        inputMode="text"
        inputValue={inputValue}
        invalid={inputInvalid}
        label={t("audio.syncOffset.valueLabel")}
        markers={[
          { label: formatOffset(editableRange.minOffsetMicros), value: 0 },
          ...(includesDefault ? [{ label: formatOffset(0), value: toPercentage(0) }] : []),
          { label: formatOffset(editableRange.maxOffsetMicros), value: 100 },
        ]}
        onDoubleClick={includesDefault ? () => updateOffset(0, true) : undefined}
        onInputBlur={() => {
          if (inputInvalid) return;
          setInput({
            offsetMicros: offset.offsetMicros,
            text: formatOffset(displayOffsetMicros),
          });
        }}
        onInputChange={updateInput}
        onSliderChange={(value) => {
          const offsetMicros = editableRange.minOffsetMicros + (value / 100) * span;
          const normalizedOffsetMicros = Math.max(
            editableRange.minOffsetMicros,
            Math.min(
              editableRange.maxOffsetMicros,
              toMilliseconds(offsetMicros) * MICROS_PER_MILLISECOND,
            ),
          );

          updateOffset(normalizedOffsetMicros, true);
        }}
        placeholder={t("audio.syncOffset.inputPlaceholder")}
        sliderMax={100}
        sliderMin={0}
        sliderStep={0.01}
        sliderValue={percentage}
        sliderValueText={formatOffset(displayOffsetMicros)}
      />
    </div>
  );
}

export { SyncOffsetFilterPage };
