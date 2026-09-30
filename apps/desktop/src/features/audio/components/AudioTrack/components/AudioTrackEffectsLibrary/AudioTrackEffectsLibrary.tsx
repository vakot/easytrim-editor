import { Check } from "lucide-react";
import { type ReactNode, useState } from "react";
import { useTranslation } from "react-i18next";

import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { AUDIO_PROCESSING_STAGES, type AudioProcessingStage } from "@/domain/audio-processing";
import { cn } from "@/lib/class-names.utils";

import {
  type AudioTrackEffectsDraft,
  useAudioTrackEffectsDraft,
} from "../AudioTrackEffectsDialog/contexts/audio-track-effects-draft-context";

import { AUDIO_TRACK_EFFECTS, type AudioTrackEffectDescriptor } from "./consts/audio-track-effects";

interface AudioTrackEffectsLibraryProps {
  effects?: readonly AudioTrackEffectDescriptor[];
  streamIndex: number;
}

function AudioTrackEffectsLibrary({
  effects = AUDIO_TRACK_EFFECTS,
  streamIndex,
}: AudioTrackEffectsLibraryProps) {
  const { t } = useTranslation();
  const stageGroups = AUDIO_PROCESSING_STAGES.map((stage) => ({
    effects: effects.filter((effect) => effect.stage === stage),
    stage,
  })).filter(({ effects: stageEffects }) => stageEffects.length > 0);

  const [selectedEffect, setSelectedEffect] = useState<string | undefined>(
    stageGroups[0]?.effects[0]?.id,
  );

  const { draft } = useAudioTrackEffectsDraft();
  const stageLabels: Record<AudioProcessingStage, string> = {
    cleanup: t("audio.labels.effectStageCleanup"),
    dynamics: t("audio.labels.effectStageDynamics"),
    finalProtection: t("audio.labels.effectStageProtection"),
    levelPolicy: t("audio.labels.effectStageLevel"),
  };

  return (
    <Tabs
      className="-mx-4 flex min-h-0 min-w-0 flex-1 gap-4"
      onValueChange={setSelectedEffect}
      orientation="vertical"
      value={selectedEffect}
    >
      <ScrollArea className="h-full min-h-0 min-w-0 pl-4">
        <TabsList aria-label={t("audio.actions.effects")} className="bg-transparent py-4">
          {stageGroups.map(({ effects: stageEffects, stage }) => (
            <div
              className="flex w-full flex-col gap-0.5"
              data-slot="audio-track-effects-stage"
              data-stage={stage}
              key={stage}
            >
              <div
                aria-hidden="true"
                className="px-2 pt-3 pb-1 text-xs font-medium text-muted-foreground"
                data-slot="audio-track-effects-stage-label"
              >
                {stageLabels[stage]}
              </div>
              {stageEffects.map((effect) => (
                <AudioTrackEffectTab draft={draft} effect={effect} key={effect.id} />
              ))}
            </div>
          ))}
        </TabsList>
      </ScrollArea>

      <Separator orientation="vertical" />

      <ScrollArea className="h-full min-h-0 min-w-0 flex-1">
        <div className="py-4 pr-4">
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
      </ScrollArea>
    </Tabs>
  );
}

function AudioTrackEffectTab({
  draft,
  effect,
}: {
  draft: AudioTrackEffectsDraft;
  effect: AudioTrackEffectDescriptor;
}) {
  const { t } = useTranslation();

  const enabled = effect.isEnabled(draft.processing);
  const dirty =
    effect.isDirty(draft.initialProcessing, draft.processing) ||
    draft.effectStatus[effect.id]?.dirty;

  return (
    <TabsTrigger className="relative h-7 min-w-0 flex-none px-8" value={effect.id}>
      <EffectTabIndicator side="left">{enabled ? <Check /> : null}</EffectTabIndicator>
      <span className="min-w-0 truncate text-left">{effect.label(t)}</span>
      <EffectTabIndicator side="right">
        {dirty ? <span className="size-1.5 rounded-full bg-current" /> : null}
      </EffectTabIndicator>
    </TabsTrigger>
  );
}

function EffectTabIndicator({ children, side }: { children?: ReactNode; side: "left" | "right" }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "pointer-events-none absolute top-1/2 flex size-4 -translate-y-1/2 items-center justify-center text-muted-foreground",
        side === "left" ? "left-2" : "right-2",
      )}
    >
      {children}
    </span>
  );
}

export { AudioTrackEffectsLibrary };
