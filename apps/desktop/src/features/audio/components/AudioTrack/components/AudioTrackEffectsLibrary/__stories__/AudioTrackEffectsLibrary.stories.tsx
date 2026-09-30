import "@/i18n/config";

import type { Meta, StoryObj } from "@storybook/react";
import { Check } from "lucide-react";
import { useMemo, useState } from "react";
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
import { MenuIcon, menuItemVariants } from "@/components/ui/menu";
import { Switch } from "@/components/ui/switch";

import { sourceReady, sourceSelected } from "@/app/store/actions/source-actions";
import { audioTrackProcessingChanged } from "@/app/store/slices/audio-slice";
import { createAppStore } from "@/app/store/store";
import { type AudioTrackProcessing, sameAudioTrackProcessing } from "@/domain/audio-processing";
import { cn } from "@/lib/class-names.utils";
import { firstSource, mediaWithAudio } from "@/test/source.fixtures";

import { getAudioTrackEffectsDraftProcessing } from "../../AudioTrackEffectsDialog/audio-track-effects-draft.utils";
import { AudioTrackEffectsDraftProvider } from "../../AudioTrackEffectsDialog/components/AudioTrackEffectsDraftProvider";
import { useAudioTrackEffectsDraft } from "../../AudioTrackEffectsDialog/contexts/audio-track-effects-draft-context";
import {
  AudioTrackEffectsLibraryPage,
  AudioTrackEffectsLibraryPageAdvanced,
  AudioTrackEffectsLibraryPageBasic,
  AudioTrackEffectsLibraryPageDescription,
  AudioTrackEffectsLibraryPageHeader,
  AudioTrackEffectsLibraryPageHeaderContent,
  AudioTrackEffectsLibraryPageTitle,
} from "../components/AudioTrackEffectsLibraryPage";
import { NormalizeLoudnessPage } from "../pages/NormalizeLoudnessPage";

const effects = [
  "High-pass",
  "Noise reduction",
  "Noise gate",
  "Compressor",
  "Normalize Loudness",
  "Limiter",
] as const;

type Effect = (typeof effects)[number];

interface EffectState {
  enabled: boolean;
  isDirty: boolean;
}

type EffectsState = Record<Effect, EffectState>;

const initialEffectsState: EffectsState = {
  "High-pass": { enabled: false, isDirty: false },
  "Noise reduction": { enabled: true, isDirty: false },
  "Noise gate": { enabled: false, isDirty: false },
  Compressor: { enabled: false, isDirty: false },
  "Normalize Loudness": { enabled: true, isDirty: false },
  Limiter: { enabled: false, isDirty: false },
};

function EffectsLibraryStory({
  initialProcessing,
  streamIndex,
}: {
  initialProcessing: AudioTrackProcessing;
  streamIndex: number;
}) {
  const { draft } = useAudioTrackEffectsDraft();
  const [selected, setSelected] = useState<Effect>("Normalize Loudness");
  const [effectStates, setEffectStates] = useState(initialEffectsState);
  const selectedState = effectStates[selected];

  const setEffectEnabled = (effect: Effect, enabled: boolean) => {
    setEffectStates((current) => ({
      ...current,
      [effect]: { ...current[effect], enabled, isDirty: true },
    }));
  };

  const markEffectDirty = (effect: Effect) => {
    setEffectStates((current) => ({
      ...current,
      [effect]: { ...current[effect], isDirty: true },
    }));
  };

  return (
    <div className="-mx-4 flex min-h-80 min-w-0 flex-1">
      <nav aria-label="Audio effects" className="w-64 shrink-0 border-r px-2 py-3">
        {effects.map((effect) => {
          const state = effectStates[effect];
          const enabled =
            effect === "Normalize Loudness"
              ? draft.processing.loudnessNormalization !== undefined
              : state.enabled;

          const dirty =
            effect === "Normalize Loudness"
              ? !sameAudioTrackProcessing(
                  initialProcessing,
                  getAudioTrackEffectsDraftProcessing(draft),
                ) ||
                (draft.effectStatus.loudnessNormalization?.dirty ?? false)
              : state.isDirty;

          return (
            <button
              aria-current={selected === effect ? "page" : undefined}
              className={cn(
                menuItemVariants({ kind: "checkbox" }),
                "w-full min-w-0 justify-start whitespace-nowrap",
              )}
              data-inset
              data-selected={selected === effect}
              key={effect}
              onClick={() => setSelected(effect)}
              type="button"
            >
              {enabled ? (
                <MenuIcon>
                  <Check />
                </MenuIcon>
              ) : null}
              <span className="min-w-0 truncate">{effect}</span>
              <MenuIcon aria-hidden="true" className={dirty ? undefined : "opacity-0"} side="right">
                <span className="size-1.5 rounded-full bg-current" />
              </MenuIcon>
            </button>
          );
        })}
      </nav>

      <div className="min-w-0 flex-1 overflow-y-auto p-4">
        {selected === "Normalize Loudness" ? (
          <NormalizeLoudnessPage streamIndex={streamIndex} />
        ) : (
          <PlaceholderPage
            effect={selected}
            enabled={selectedState.enabled}
            onChange={() => markEffectDirty(selected)}
            onEnabledChange={(enabled) => setEffectEnabled(selected, enabled)}
          />
        )}
      </div>
    </div>
  );
}

function PlaceholderPage({
  effect,
  enabled,
  onChange,
  onEnabledChange,
}: {
  effect: Effect;
  enabled: boolean;
  onChange: () => void;
  onEnabledChange: (enabled: boolean) => void;
}) {
  return (
    <AudioTrackEffectsLibraryPage>
      <AudioTrackEffectsLibraryPageHeader>
        <AudioTrackEffectsLibraryPageHeaderContent>
          <AudioTrackEffectsLibraryPageTitle>{effect}</AudioTrackEffectsLibraryPageTitle>
          <AudioTrackEffectsLibraryPageDescription>
            Effect controls will be shown here.
          </AudioTrackEffectsLibraryPageDescription>
        </AudioTrackEffectsLibraryPageHeaderContent>
        <Switch checked={enabled} onCheckedChange={onEnabledChange} />
      </AudioTrackEffectsLibraryPageHeader>
      <AudioTrackEffectsLibraryPageBasic>
        <Button onClick={onChange} type="button" variant="outline">
          Change draft
        </Button>
      </AudioTrackEffectsLibraryPageBasic>
      <AudioTrackEffectsLibraryPageAdvanced>
        <p className="text-sm text-muted-foreground">Advanced controls can be added here.</p>
      </AudioTrackEffectsLibraryPageAdvanced>
    </AudioTrackEffectsLibraryPage>
  );
}

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
  const { draft } = useAudioTrackEffectsDraft();

  return (
    <DialogContent className="max-h-[calc(100dvh-2rem)] gap-0 overflow-hidden sm:max-w-3xl">
      <DialogHeader className="-mx-4 border-b px-4 pb-4">
        <DialogTitle>Audio 1 — Effects</DialogTitle>
        <DialogDescription>Configure audio processing for this track.</DialogDescription>
      </DialogHeader>
      <EffectsLibraryStory initialProcessing={initialProcessing} streamIndex={streamIndex} />
      <DialogFooter className="-mx-4 border-t px-4 pt-4">
        <DialogClose asChild>
          <Button type="button" variant="outline">
            Cancel
          </Button>
        </DialogClose>
        <DialogClose asChild>
          <Button
            disabled={draft.processing.loudnessNormalization === undefined}
            onClick={() => undefined}
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
