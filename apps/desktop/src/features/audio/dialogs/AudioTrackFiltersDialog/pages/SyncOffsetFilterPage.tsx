import { useId, useState } from "react";
import { useTranslation } from "react-i18next";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";

import { type AudioSyncOffset, MAX_AUDIO_SYNC_OFFSET_MICROS } from "@/domain/audio-processing";
import { cn } from "@/lib/class-names.utils";

import { useAudioFiltersDraft } from "../contexts/audio-filters-draft-context";

const MICROS_PER_MILLISECOND = 1_000;

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
  const match = /^([+-]|−)?(\d{2}):(\d{2})\.(\d{3})$/.exec(value.trim());
  if (!match) return null;
  const [, sign, minutesText, secondsText, millisecondsText] = match;
  const minutes = Number(minutesText);
  const seconds = Number(secondsText);
  if (seconds > 59) return null;
  const magnitude = ((minutes * 60 + seconds) * 1_000 + Number(millisecondsText)) * 1_000;
  return sign === "-" || sign === "−" ? -magnitude : magnitude;
}

function SyncOffsetFilterPage({ offset }: { offset: AudioSyncOffset }) {
  const { t } = useTranslation();
  const { dispatch } = useAudioFiltersDraft();
  const id = useId();
  const [input, setInput] = useState(() => ({
    offsetMicros: offset.offsetMicros,
    text: formatOffset(offset.offsetMicros),
  }));

  const inputValue =
    input.offsetMicros === offset.offsetMicros ? input.text : formatOffset(offset.offsetMicros);

  const parsedInput = parseOffset(input.text);
  const inputInvalid =
    parsedInput === null ||
    Math.abs(parsedInput) > MAX_AUDIO_SYNC_OFFSET_MICROS ||
    Math.abs(offset.offsetMicros) > MAX_AUDIO_SYNC_OFFSET_MICROS;

  const percentage = Math.max(
    0,
    Math.min(
      100,
      ((offset.offsetMicros + MAX_AUDIO_SYNC_OFFSET_MICROS) / (2 * MAX_AUDIO_SYNC_OFFSET_MICROS)) *
        100,
    ),
  );

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

    const invalidOffsetMicros = MAX_AUDIO_SYNC_OFFSET_MICROS + 1_000;
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

      <div className="grid gap-2">
        <Label htmlFor={id}>{t("audio.syncOffset.valueLabel")}</Label>
        <Input
          aria-describedby={`${id}-format`}
          aria-invalid={inputInvalid}
          id={id}
          inputMode="text"
          onBlur={() => {
            if (inputInvalid) return;
            setInput({
              offsetMicros: offset.offsetMicros,
              text: formatOffset(offset.offsetMicros),
            });
          }}
          onChange={(event) => updateInput(event.target.value)}
          placeholder={t("audio.syncOffset.inputPlaceholder")}
          value={inputValue}
        />
        <p
          aria-live={inputInvalid ? "polite" : undefined}
          className={cn("text-xs", inputInvalid ? "text-destructive" : "text-muted-foreground")}
          id={`${id}-format`}
        >
          {t("audio.syncOffset.range", { max: "00:10.000" })}
        </p>
      </div>

      <div className="grid gap-3 border-t pt-4">
        <Label htmlFor={`${id}-slider`}>{t("audio.syncOffset.sliderLabel")}</Label>
        <div className="grid grid-cols-[auto_1fr_auto] items-center gap-3">
          <span className="text-xs text-muted-foreground">−00:10.000</span>
          <Slider
            aria-label={t("audio.syncOffset.sliderLabel")}
            aria-valuetext={formatOffset(offset.offsetMicros)}
            id={`${id}-slider`}
            max={100}
            min={0}
            onValueChange={([value]) => {
              const next = Math.round(
                (((value ?? 50) / 100) * 2 - 1) * MAX_AUDIO_SYNC_OFFSET_MICROS,
              );

              updateOffset(next, true);
            }}
            step={0.1}
            value={[percentage]}
          />
          <span className="text-xs text-muted-foreground">+00:10.000</span>
        </div>
      </div>
    </div>
  );
}

export { SyncOffsetFilterPage };
