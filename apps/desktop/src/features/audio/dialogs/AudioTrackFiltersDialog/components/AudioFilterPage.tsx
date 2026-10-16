import { Settings } from "lucide-react";
import { useId } from "react";
import { useTranslation } from "react-i18next";

import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";

import {
  AUDIO_FILTER_PRESETS,
  type AudioFilter,
  type AudioFilterPreset,
  type AudioFilterType,
  matchingAudioFilterPreset,
} from "@/domain/audio-processing";

import { useAudioFiltersDraft } from "../contexts/audio-filters-draft-context";
import { audioFilterDescriptor } from "../lib/audio-filter-fields";

import { AudioFilterParameterField } from "./AudioFilterParameterField";

const CUSTOM_PRESET = "custom";

/** Name, description, presets, and the explicit parameters of one filter instance. */
function AudioFilterPage({ filter }: { filter: AudioFilter }) {
  const { t } = useTranslation();
  const descriptor = audioFilterDescriptor(filter.type);

  return (
    <div className="grid gap-4" data-slot="audio-filter-page">
      <div className="border-b pb-3">
        <h3 className="font-semibold">{descriptor.label(t)}</h3>
        <p className="mt-1 text-sm text-muted-foreground">{descriptor.description(t)}</p>
      </div>

      <AudioFilterPresetSelect filter={filter} />

      <div className="flex items-center gap-3">
        <h4 className="flex shrink-0 items-center gap-1 text-sm font-medium text-muted-foreground">
          <Settings aria-hidden="true" className="size-4" />
          {t("audio.tracks.advanced")}
        </h4>
        <Separator className="flex-1" />
      </div>

      <div className="grid gap-4">
        {descriptor.fields.map((field) => (
          <AudioFilterParameterField field={field} filter={filter} key={field.parameter} />
        ))}
      </div>
    </div>
  );
}

/**
 * Presets only fill explicit parameters. The selection is derived from the current values, so an
 * edited parameter shows "Custom" and nothing about the preset is stored.
 */
function AudioFilterPresetSelect({ filter }: { filter: AudioFilter }) {
  const { t } = useTranslation();
  const id = useId();
  const { dispatch } = useAudioFiltersDraft();
  const presets = AUDIO_FILTER_PRESETS[
    filter.type
  ] as readonly AudioFilterPreset<AudioFilterType>[];

  const presetLabels = audioFilterDescriptor(filter.type).presetLabels;
  if (presets.length === 0) return null;
  const selected = matchingAudioFilterPreset(filter) ?? CUSTOM_PRESET;

  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{t("audio.filters.preset.label")}</Label>
      <Select
        onValueChange={(presetId) => {
          const preset = presets.find((candidate) => candidate.id === presetId);
          if (preset) {
            dispatch({
              filter: { ...filter, ...preset.parameters } as AudioFilter,
              type: "updated",
            });
          }
        }}
        value={selected}
      >
        <SelectTrigger className="w-full max-w-xs" id={id}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {presets.map((preset) => (
            <SelectItem key={preset.id} value={preset.id}>
              {presetLabels[preset.id]?.(t) ?? preset.id}
            </SelectItem>
          ))}
          {selected === CUSTOM_PRESET ? (
            <SelectItem disabled value={CUSTOM_PRESET}>
              {t("audio.filters.preset.custom")}
            </SelectItem>
          ) : null}
        </SelectContent>
      </Select>
    </div>
  );
}

export { AudioFilterPage };
