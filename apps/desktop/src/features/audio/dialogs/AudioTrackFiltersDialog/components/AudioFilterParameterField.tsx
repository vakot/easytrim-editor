import { useId, useState } from "react";
import { useTranslation } from "react-i18next";

import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
} from "@/components/ui/input-group";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";

import {
  type AudioFilter,
  audioFilterParameterRange,
  audioFilterParameterValue,
  type AudioFilterType,
  isAudioFilterParameterValid,
} from "@/domain/audio-processing";

import { useAudioFiltersDraft } from "../contexts/audio-filters-draft-context";
import type { AudioFilterField } from "../lib/audio-filter-fields";

function formatValue(value: number): string {
  return Number.isFinite(value) ? String(Number(value.toFixed(3))) : "";
}

function parseValue(text: string): number {
  return text.trim() ? Number(text.replace(",", ".")) : Number.NaN;
}

/** One explicit filter parameter: a slider over its practical span and an exact numeric input. */
function AudioFilterParameterField({
  field,
  filter,
}: {
  field: AudioFilterField<AudioFilterType>;
  filter: AudioFilter;
}) {
  const { t } = useTranslation();
  const id = useId();
  const { dispatch } = useAudioFiltersDraft();
  // The typed text while editing, so partial input such as "-" stays visible.
  const [text, setText] = useState<string | null>(null);
  const range = audioFilterParameterRange(filter.type, field.parameter);
  const value = audioFilterParameterValue(filter, field.parameter);
  const valid = isAudioFilterParameterValid(filter.type, field.parameter, value);
  const label = field.label(t);
  const errorId = `${id}-error`;

  const update = (next: number) =>
    dispatch({ filter: { ...filter, [field.parameter]: next } as AudioFilter, type: "updated" });

  return (
    <div className="grid gap-2" data-slot="audio-filter-parameter">
      <Label htmlFor={id}>{label}</Label>
      <div className="flex items-center gap-3">
        <Slider
          aria-label={label}
          aria-valuetext={`${formatValue(value)} ${field.unit}`}
          className="flex-1"
          max={field.slider.max}
          min={field.slider.min}
          onValueChange={([next]) => {
            if (next === undefined) return;
            setText(null);
            update(next);
          }}
          step={field.step}
          value={[
            Number.isFinite(value)
              ? Math.min(field.slider.max, Math.max(field.slider.min, value))
              : field.slider.min,
          ]}
        />
        <InputGroup className="w-32 shrink-0">
          <InputGroupInput
            aria-describedby={valid ? undefined : errorId}
            aria-invalid={!valid}
            id={id}
            inputMode="decimal"
            onBlur={() => setText(null)}
            onChange={(event) => {
              setText(event.target.value);
              update(parseValue(event.target.value));
            }}
            value={text ?? formatValue(value)}
          />
          <InputGroupAddon align="inline-end">
            <InputGroupText>{field.unit}</InputGroupText>
          </InputGroupAddon>
        </InputGroup>
      </div>
      {valid ? null : (
        <p className="text-xs text-destructive" id={errorId}>
          {t("audio.filters.parameterRange", {
            max: formatValue(range.max),
            min: formatValue(range.min),
            unit: field.unit,
          })}
        </p>
      )}
    </div>
  );
}

export { AudioFilterParameterField };
