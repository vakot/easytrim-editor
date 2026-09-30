import {
  AudioTrackEffectsLibraryPage,
  AudioTrackEffectsLibraryPageAdvanced,
  AudioTrackEffectsLibraryPageBasic,
  AudioTrackEffectsLibraryPageContent,
} from "../../components/AudioTrackEffectsLibraryPage";

import { NormalizeLoudnessCustomSettings } from "./components/NormalizeLoudnessCustomSettings";
import { NormalizeLoudnessHeader } from "./components/NormalizeLoudnessHeader";
import { NormalizeLoudnessPreset } from "./components/NormalizeLoudnessPreset";
import { NormalizeLoudnessProvider } from "./components/NormalizeLoudnessProvider";
import { useNormalizeLoudnessContext } from "./contexts/normalize-loudness-context";

function NormalizeLoudnessPage({ streamIndex }: { streamIndex: number }) {
  return (
    <NormalizeLoudnessProvider streamIndex={streamIndex}>
      <NormalizeLoudnessPageContent streamIndex={streamIndex} />
    </NormalizeLoudnessProvider>
  );
}

function NormalizeLoudnessPageContent({ streamIndex }: { streamIndex: number }) {
  const { form } = useNormalizeLoudnessContext();

  return (
    <AudioTrackEffectsLibraryPage>
      <NormalizeLoudnessHeader />

      <AudioTrackEffectsLibraryPageContent disabled={!form.enabled}>
        <AudioTrackEffectsLibraryPageBasic>
          <NormalizeLoudnessPreset streamIndex={streamIndex} />
        </AudioTrackEffectsLibraryPageBasic>

        <AudioTrackEffectsLibraryPageAdvanced>
          <NormalizeLoudnessCustomSettings streamIndex={streamIndex} />
        </AudioTrackEffectsLibraryPageAdvanced>
      </AudioTrackEffectsLibraryPageContent>
    </AudioTrackEffectsLibraryPage>
  );
}

export { NormalizeLoudnessPage };
