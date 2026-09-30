import { Check } from "lucide-react";
import { type ReactNode, useState } from "react";
import { useTranslation } from "react-i18next";

import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

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
  const [selectedEffect, setSelectedEffect] = useState<string | undefined>(effects[0]?.id);
  const { draft } = useAudioTrackEffectsDraft();

  return (
    <Tabs
      className="flex min-h-72 min-w-0 flex-1 gap-3"
      onValueChange={setSelectedEffect}
      orientation="vertical"
      value={selectedEffect}
    >
      <ScrollArea className="h-full shrink-0 py-3">
        <TabsList aria-label={t("audio.actions.effects")} className="bg-transparent p-0">
          {effects.map((effect) => (
            <AudioTrackEffectTab draft={draft} effect={effect} />
          ))}
        </TabsList>
      </ScrollArea>

      <Separator orientation="vertical" />

      <ScrollArea className="flex-1 py-3">
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
    <TabsTrigger className="relative min-w-0 px-8" key={effect.id} value={effect.id}>
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
