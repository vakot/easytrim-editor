import "@/i18n/config";

import type { Meta, StoryObj } from "@storybook/react";
import { useMemo } from "react";
import { Provider } from "react-redux";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";

import { sourceReady, sourceSelected } from "@/app/store/actions/source-actions";
import { useAppDispatch } from "@/app/store/redux-hooks";
import { audioTrackProcessingChanged } from "@/app/store/slices/audio-slice";
import { createAppStore } from "@/app/store/store";
import { type AudioTrackProcessing, sameAudioTrackProcessing } from "@/domain/audio-processing";
import { firstSource, mediaWithAudio } from "@/test/source.fixtures";

import { AudioTrackEffectsDraftProvider } from "../../AudioTrackEffectsDialog/components/AudioTrackEffectsDraftProvider";
import { useAudioTrackEffectsDraft } from "../../AudioTrackEffectsDialog/contexts/audio-track-effects-draft-context";
import {
  AUDIO_TRACK_EFFECTS,
  type AudioTrackEffectDescriptor,
} from "../consts/audio-track-effects";
import { AudioTrackEffectsLibrary } from "../AudioTrackEffectsLibrary";
import {
  AudioTrackEffectsLibraryPage,
  AudioTrackEffectsLibraryPageBasic,
  AudioTrackEffectsLibraryPageDescription,
  AudioTrackEffectsLibraryPageHeader,
  AudioTrackEffectsLibraryPageHeaderContent,
  AudioTrackEffectsLibraryPageTitle,
} from "../components/AudioTrackEffectsLibraryPage";

function PlaceholderEffectPage() {
  return (
    <AudioTrackEffectsLibraryPage>
      <AudioTrackEffectsLibraryPageHeader>
        <AudioTrackEffectsLibraryPageHeaderContent>
          <AudioTrackEffectsLibraryPageTitle>Noise reduction</AudioTrackEffectsLibraryPageTitle>
          <AudioTrackEffectsLibraryPageDescription>
            This effect is disabled, but its settings page remains available.
          </AudioTrackEffectsLibraryPageDescription>
        </AudioTrackEffectsLibraryPageHeaderContent>
        <Switch aria-label="Noise reduction" checked={false} />
      </AudioTrackEffectsLibraryPageHeader>
      <AudioTrackEffectsLibraryPageBasic>
        <p className="text-sm text-muted-foreground">Effect controls can be configured here.</p>
      </AudioTrackEffectsLibraryPageBasic>
    </AudioTrackEffectsLibraryPage>
  );
}

const storyEffects: readonly AudioTrackEffectDescriptor[] = [
  ...AUDIO_TRACK_EFFECTS,
  {
    id: "noiseReduction",
    stage: "cleanup",
    label: () => "Noise reduction",
    Page: PlaceholderEffectPage,
    isEnabled: () => false,
    isDirty: () => true,
  },
];

function EffectsLibraryStoryDialog() {
  const store = useMemo(() => {
    const appStore = createAppStore({
      getItem: async () => null,
      setItem: async () => undefined,
      removeItem: async () => undefined,
    });

    const media = mediaWithAudio(firstSource.sourcePath);
    const streamIndex = media.audioStreams[0]?.streamIndex ?? 0;
    const processing: AudioTrackProcessing = { gainDb: 0, loudnessNormalization: "streaming" };

    appStore.dispatch(sourceSelected({ source: firstSource }));
    appStore.dispatch(sourceReady({ loadToken: 1, media }));
    appStore.dispatch(audioTrackProcessingChanged({ processing, streamIndex }));
    return { processing, store: appStore, streamIndex };
  }, []);

  return (
    <Provider store={store.store}>
      <Dialog defaultOpen>
        <AudioTrackEffectsDraftProvider initialProcessing={store.processing}>
          <EffectsLibraryStoryContent
            initialProcessing={store.processing}
            streamIndex={store.streamIndex}
          />
        </AudioTrackEffectsDraftProvider>
      </Dialog>
    </Provider>
  );
}

function EffectsLibraryStoryContent({
  initialProcessing,
  streamIndex,
}: {
  initialProcessing: AudioTrackProcessing;
  streamIndex: number;
}) {
  const dispatch = useAppDispatch();
  const { draft } = useAudioTrackEffectsDraft();

  return (
    <DialogContent className="max-h-[calc(100dvh-2rem)] gap-0 overflow-hidden sm:max-w-3xl">
      <DialogHeader className="-mx-4 border-b px-4 pb-4">
        <DialogTitle>Audio 1 — Effects</DialogTitle>
        <DialogDescription>Configure audio processing for this track.</DialogDescription>
      </DialogHeader>
      <AudioTrackEffectsLibrary effects={storyEffects} streamIndex={streamIndex} />
      <DialogFooter className="-mx-4 border-t px-4 pt-4">
        <DialogClose asChild>
          <Button type="button" variant="outline">
            Cancel
          </Button>
        </DialogClose>
        <DialogClose asChild>
          <Button
            disabled={
              Object.values(draft.effectStatus).some(({ valid }) => !valid) ||
              sameAudioTrackProcessing(draft.processing, initialProcessing)
            }
            onClick={() =>
              dispatch(audioTrackProcessingChanged({ processing: draft.processing, streamIndex }))
            }
            type="button"
          >
            Apply
          </Button>
        </DialogClose>
      </DialogFooter>
    </DialogContent>
  );
}

const meta = {
  parameters: { layout: "centered" },
  title: "Features/Audio/AudioTrackEffectsLibrary",
} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => <EffectsLibraryStoryDialog />,
};
