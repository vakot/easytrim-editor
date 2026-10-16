import type { TFunction } from "i18next";

import type { AudioFilterParameters, AudioFilterType } from "@/domain/audio-processing";

interface AudioFilterField<T extends AudioFilterType> {
  label: (t: TFunction) => string;
  parameter: keyof AudioFilterParameters<T> & string;
  /** A practical slider span inside the valid range; the input accepts the whole range. */
  slider: { max: number; min: number };
  step: number;
  /** Technical units stay untranslated. */
  unit: string;
}

/** What the page of one filter type shows besides its name: description, parameters, presets. */
interface AudioFilterPageContent<T extends AudioFilterType> {
  description: (t: TFunction) => string;
  fields: readonly AudioFilterField<T>[];
  presetLabels: Readonly<Record<string, (t: TFunction) => string>>;
}

/**
 * Checks the parameter names of one type's page against that type, then widens the content to
 * what the shared page layout takes for any type.
 */
function defineAudioFilterPageContent<T extends AudioFilterType>(
  content: AudioFilterPageContent<T>,
): AudioFilterPageContent<AudioFilterType> {
  return content as unknown as AudioFilterPageContent<AudioFilterType>;
}

export type { AudioFilterField, AudioFilterPageContent };
export { defineAudioFilterPageContent };
