import { Check } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { MenuIcon, menuItemVariants } from "@/components/ui/menu";

import { cn } from "@/lib/class-names.utils";

import { useAudioTrackEffectsDraft } from "../AudioTrackEffectsDialog/contexts/audio-track-effects-draft-context";

import {
  AUDIO_TRACK_EFFECTS,
  type AudioTrackEffectDescriptor,
} from "./audio-track-effects.registry";

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
    <div className="-mx-4 flex min-h-72 min-w-0 flex-1">
      <nav aria-label={t("audio.actions.effects")} className="w-64 shrink-0 border-r px-2 py-3">
        {effects.map((effect) => (
          <button
            aria-current={selectedEffect === effect.id ? "page" : undefined}
            className={cn(
              menuItemVariants({ kind: "checkbox" }),
              "w-full min-w-0 justify-start whitespace-nowrap",
            )}
            data-inset
            data-selected={selectedEffect === effect.id}
            key={effect.id}
            onClick={() => setSelectedEffect(effect.id)}
            type="button"
          >
            {effect.isEnabled(draft.processing) ? (
              <MenuIcon>
                <Check />
              </MenuIcon>
            ) : null}
            <span className="min-w-0 truncate">{effect.label(t)}</span>
            <MenuIcon
              aria-hidden="true"
              className={
                effect.isDirty(draft.initialProcessing, draft.processing) ||
                draft.effectStatus[effect.id]?.dirty
                  ? undefined
                  : "opacity-0"
              }
              side="right"
            >
              <span className="size-1.5 rounded-full bg-current" />
            </MenuIcon>
          </button>
        ))}
      </nav>

      <div className="min-w-0 flex-1 overflow-y-auto p-4">
        {effects.map(({ id, Page }) => (
          <div aria-hidden={selectedEffect !== id} hidden={selectedEffect !== id} key={id}>
            <Page streamIndex={streamIndex} />
          </div>
        ))}
      </div>
    </div>
  );
}

export { AudioTrackEffectsLibrary };
