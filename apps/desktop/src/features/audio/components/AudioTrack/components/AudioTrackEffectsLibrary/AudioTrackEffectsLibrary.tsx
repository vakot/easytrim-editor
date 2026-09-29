import { Check } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { MenuIcon, menuItemVariants } from "@/components/ui/menu";

import { useAppSelector } from "@/app/store/redux-hooks";
import { selectAudioTracks } from "@/app/store/slices/audio-slice";
import { sameAudioTrackPreviewProcessing } from "@/domain/audio-processing";
import { cn } from "@/lib/class-names.utils";

import { getAudioTrackEffectsDraftProcessing } from "../AudioTrackEffectsDialog/audio-track-effects-draft.utils";
import { useAudioTrackEffectsDraft } from "../AudioTrackEffectsDialog/contexts/audio-track-effects-draft-context";

import { NormalizeLoudnessPage } from "./pages/NormalizeLoudnessPage";

interface AudioTrackEffectsLibraryProps {
  streamIndex: number;
}

const EFFECTS = ["loudnessNormalization"] as const;

function AudioTrackEffectsLibrary({ streamIndex }: AudioTrackEffectsLibraryProps) {
  const { t } = useTranslation();
  const [selectedEffect, setSelectedEffect] =
    useState<(typeof EFFECTS)[number]>("loudnessNormalization");

  const track = useAppSelector((state) =>
    selectAudioTracks(state).find((candidate) => candidate.streamIndex === streamIndex),
  );

  const { draft } = useAudioTrackEffectsDraft();

  if (!track) return null;

  const draftProcessing = getAudioTrackEffectsDraftProcessing(draft);
  const isNormalizationDirty = !sameAudioTrackPreviewProcessing(track.processing, draftProcessing);

  return (
    <div className="-mx-4 flex min-h-72 min-w-0 flex-1">
      <nav aria-label={t("audio.actions.effects")} className="w-52 shrink-0 border-r px-2 py-3">
        {EFFECTS.map((effect) => (
          <button
            aria-current={selectedEffect === effect ? "page" : undefined}
            className={cn(menuItemVariants({ kind: "checkbox" }), "w-full justify-start")}
            data-inset
            data-selected={selectedEffect === effect}
            key={effect}
            onClick={() => setSelectedEffect(effect)}
            type="button"
          >
            {draft.normalizationEnabled ? (
              <MenuIcon>
                <Check />
              </MenuIcon>
            ) : null}
            {t("audio.labels.loudnessNormalization")}
            <MenuIcon
              aria-hidden="true"
              className={isNormalizationDirty ? undefined : "opacity-0"}
              side="right"
            >
              <span className="size-1.5 rounded-full bg-current" />
            </MenuIcon>
          </button>
        ))}
      </nav>

      <div className="min-w-0 flex-1 overflow-y-auto p-4">
        {selectedEffect === "loudnessNormalization" ? (
          <NormalizeLoudnessPage streamIndex={streamIndex} />
        ) : null}
      </div>
    </div>
  );
}

export { AudioTrackEffectsLibrary };
