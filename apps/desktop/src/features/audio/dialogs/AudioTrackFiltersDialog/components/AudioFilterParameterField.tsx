import { useState } from "react";
import { useTranslation } from "react-i18next";

import {
  type AudioFilter,
  audioFilterParameterRange,
  audioFilterParameterValue,
  type AudioFilterType,
  isAudioFilterParameterValid,
} from "@/domain/audio-processing";

import { useAudioFiltersDraft } from "../contexts/audio-filters-draft-context";
import type { AudioFilterField } from "../lib/audio-filter-fields";

import { AudioParameterSliderInput } from "./AudioParameterSliderInput";

function formatValue(value: number): string {
  return Number.isFinite(value) ? String(Number(value.toFixed(3))) : "";
}

function parseValue(text: string): number {
  return text.trim() ? Number(text.replace(",", ".")) : Number.NaN;
}

/** Connects one filter parameter to the shared slider and exact-value input. */
function AudioFilterParameterField({
  field,
  filter,
}: {
  field: AudioFilterField<AudioFilterType>;
  filter: AudioFilter;
}) {
  const { t } = useTranslation();
  const { dispatch } = useAudioFiltersDraft();
  // The typed text while editing, so partial input such as "-" stays visible.
  const [text, setText] = useState<string | null>(null);
  const range = audioFilterParameterRange(filter.type, field.parameter);
  const value = audioFilterParameterValue(filter, field.parameter);
  const valid = isAudioFilterParameterValid(filter.type, field.parameter, value);
  const label = field.label(t);
  const defaultValue = field.defaultValue;

  const update = (next: number) =>
    dispatch({ filter: { ...filter, [field.parameter]: next } as AudioFilter, type: "updated" });

  const sliderValue = Number.isFinite(value)
    ? Math.min(range.max, Math.max(range.min, value))
    : range.min;

  const markers = [
    { label: `${formatValue(range.min)} ${field.unit}`, value: range.min },
    ...(defaultValue === undefined
      ? []
      : [{ label: `${formatValue(defaultValue)} ${field.unit}`, value: defaultValue }]),
    { label: `${formatValue(range.max)} ${field.unit}`, value: range.max },
  ];

  return (
    <AudioParameterSliderInput
      error={
        valid
          ? undefined
          : t("audio.filters.parameterRange", {
              max: formatValue(range.max),
              min: formatValue(range.min),
              unit: field.unit,
            })
      }
      inputMode="decimal"
      inputUnit={field.unit}
      inputValue={text ?? formatValue(value)}
      invalid={!valid}
      label={label}
      markers={markers}
      onDoubleClick={
        defaultValue === undefined
          ? undefined
          : () => {
              setText(null);
              update(defaultValue);
            }
      }
      onInputBlur={() => setText(null)}
      onInputChange={(nextText) => {
        setText(nextText);
        update(parseValue(nextText));
      }}
      onSliderChange={(next) => {
        setText(null);
        update(next);
      }}
      sliderMax={range.max}
      sliderMin={range.min}
      sliderStep={field.step}
      sliderValue={sliderValue}
      sliderValueText={`${formatValue(value)} ${field.unit}`}
    />
  );
}

export { AudioFilterParameterField };
