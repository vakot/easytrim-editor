import { AudioLines } from "lucide-react";
import { useTranslation } from "react-i18next";

import {
  type ApplicationCommandExecutionContext,
  commandOrigin,
} from "@/app/commands/core/application-command.types";
import { commandSearchTerms } from "@/app/commands/core/application-command.utils";
import { useAppDispatch, useAppSelector } from "@/app/store/redux-hooks";
import { selectAudioTracks } from "@/app/store/slices/audio-slice";
import { selectSourceReady } from "@/app/store/slices/source-slice";
import { startAudioExportRequested } from "@/app/store/thunks/export-thunks";

import { AUDIO_EXPORT_SHORTCUT } from "../file-shortcuts.constants";

function useAudioExportCommand() {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const sourceReady = useAppSelector(selectSourceReady);
  const hasSelectedAudio = useAppSelector((state) =>
    selectAudioTracks(state).some((track) => track.enabled),
  );

  return {
    enabled: sourceReady && hasSelectedAudio,
    icon: <AudioLines aria-hidden="true" />,
    async run({ surface }: ApplicationCommandExecutionContext) {
      await dispatch(startAudioExportRequested(commandOrigin("audio-export", surface)));
    },
    id: "audio-export" as const,
    label: t("export.audioExport.action"),
    searchTerms: commandSearchTerms(t("commands.searchTerms.audioExport")),
    shortcut: AUDIO_EXPORT_SHORTCUT,
    variant: "default" as const,
  };
}

export { useAudioExportCommand };
