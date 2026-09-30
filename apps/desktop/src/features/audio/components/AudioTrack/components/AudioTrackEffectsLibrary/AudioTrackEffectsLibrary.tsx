import { Check } from "lucide-react";
import { type ReactNode, useState } from "react";
import { useTranslation } from "react-i18next";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { useAudioTrackEffectsDraft } from "../AudioTrackEffectsDialog/contexts/audio-track-effects-draft-context";

import {
  AUDIO_TRACK_EFFECTS,
  type AudioTrackEffectDescriptor,
} from "./audio-track-effects.registry";

interface AudioTrackEffectsLibraryProps {
  effects?: readonly AudioTrackEffectDescriptor[];
  streamIndex: number;
}

function EffectTabIndicator({ children, side }: { children?: ReactNode; side: "left" | "right" }) {
  return (
    <span
      aria-hidden="true"
      className={`pointer-events-none absolute ${side === "left" ? "left-2" : "right-2"} top-1/2 flex size-4 -translate-y-1/2 items-center justify-center`}
    >
      {children}
    </span>
  );
}

function AudioTrackEffectsLibrary({
  effects = AUDIO_TRACK_EFFECTS,
  streamIndex,
}: AudioTrackEffectsLibraryProps) {
  const { t } = useTranslation();
  const [selectedEffect, setSelectedEffect] = useState<string | undefined>(effects[0]?.id);
  const { draft } = useAudioTrackEffectsDraft();

  return (
    <Tabs
      className="-mx-4 flex min-h-72 min-w-0 flex-1"
      onValueChange={setSelectedEffect}
      orientation="vertical"
      value={selectedEffect}
    >
      <TabsList
        aria-label={t("audio.actions.effects")}
        className="w-64 shrink-0 items-stretch border-r px-2 py-3"
        variant="line"
      >
        {effects.map((effect) => {
          const enabled = effect.isEnabled(draft.processing);
          const dirty =
            effect.isDirty(draft.initialProcessing, draft.processing) ||
            draft.effectStatus[effect.id]?.dirty;

          return (
            <TabsTrigger className="relative min-w-0 px-8" key={effect.id} value={effect.id}>
              <EffectTabIndicator side="left">{enabled ? <Check /> : null}</EffectTabIndicator>
              <span className="min-w-0 truncate text-left">{effect.label(t)}</span>
              <EffectTabIndicator side="right">
                {dirty ? <span className="size-1.5 rounded-full bg-current" /> : null}
              </EffectTabIndicator>
            </TabsTrigger>
          );
        })}
      </TabsList>

      <div className="min-w-0 flex-1 overflow-y-auto p-4">
        {effects.map(({ id, Page }) => (
          <TabsContent
            className="data-[state=inactive]:hidden"
            forceMount
            hidden={selectedEffect !== id}
            key={id}
            value={id}
          >
            <Page streamIndex={streamIndex} />
          </TabsContent>
        ))}
      </div>
    </Tabs>
  );
}

export { AudioTrackEffectsLibrary };
