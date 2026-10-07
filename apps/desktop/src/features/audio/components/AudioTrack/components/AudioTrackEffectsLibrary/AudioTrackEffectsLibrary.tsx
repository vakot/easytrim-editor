import { Check } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { Separator } from "@/components/ui/separator";

import {
  Library,
  LibraryContent,
  LibraryNavigation,
  LibraryNavigationGroup,
  LibraryNavigationItem,
  LibraryNavigationItemIndicator,
  LibraryPage,
} from "@/components/library";
import { AUDIO_PROCESSING_STAGES, type AudioProcessingStage } from "@/domain/audio-processing";

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
    effects.find((effect) => effect.defaultSelected)?.id ?? stageGroups[0]?.effects[0]?.id,
  );

  const { draft } = useAudioTrackEffectsDraft();
  const stageLabels: Record<AudioProcessingStage, string> = {
    cleanup: t("audio.effects.stages.cleanup"),
    dynamics: t("audio.effects.stages.dynamics"),
    finalProtection: t("audio.effects.stages.protection"),
    levelPolicy: t("audio.effects.stages.level"),
  };

  return (
    <Library onValueChange={setSelectedEffect} value={selectedEffect}>
      <LibraryNavigation aria-label={t("audio.effects.open")}>
        {stageGroups.map(({ effects: stageEffects, stage }) => (
          <LibraryNavigationGroup
            data-slot="audio-track-effects-stage"
            data-stage={stage}
            key={stage}
            label={<span data-slot="audio-track-effects-stage-label">{stageLabels[stage]}</span>}
          >
            {stageEffects.map((effect) => (
              <AudioTrackEffectTab draft={draft} effect={effect} key={effect.id} />
            ))}
          </LibraryNavigationGroup>
        ))}
      </LibraryNavigation>

      <Separator orientation="vertical" />

      <LibraryContent>
        {effects.map(({ id, Page }) => (
          <LibraryPage forceMount hidden={selectedEffect !== id} key={id} value={id}>
            <Page streamIndex={streamIndex} />
          </LibraryPage>
        ))}
      </LibraryContent>
    </Library>
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
    <LibraryNavigationItem className="px-8" value={effect.id}>
      {enabled ? (
        <LibraryNavigationItemIndicator>
          <Check />
        </LibraryNavigationItemIndicator>
      ) : null}
      {effect.label(t)}
      {dirty ? (
        <LibraryNavigationItemIndicator side="right">
          <span className="size-1.5 rounded-full bg-current" />
        </LibraryNavigationItemIndicator>
      ) : null}
    </LibraryNavigationItem>
  );
}

export { AudioTrackEffectsLibrary };
