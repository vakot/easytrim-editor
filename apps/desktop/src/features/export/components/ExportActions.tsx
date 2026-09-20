import { Scissors, Settings2 } from "lucide-react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

import { useAppDispatch, useAppSelector } from "@/app/store/redux-hooks";
import { selectCropApplied, selectTransformApplied } from "@/app/store/slices/crop-slice";
import { selectSourceReady } from "@/app/store/slices/source-slice";
import { openOptimizedExportDialog, startFastCutRequested } from "@/app/store/thunks/export-thunks";

function ExportActions() {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const sourceReady = useAppSelector(selectSourceReady);
  const cropApplied = useAppSelector(selectCropApplied);
  const transformApplied = useAppSelector(selectTransformApplied);
  const fastCutAvailable = sourceReady && !cropApplied && !transformApplied;

  return (
    <div
      aria-label={t("export.accessibility.actions")}
      className="flex shrink-0 items-center gap-1"
      role="toolbar"
    >
      <ExportActionButton
        disabled={!fastCutAvailable}
        icon={<Scissors aria-hidden="true" />}
        label={t("export.actions.fast")}
        onClick={() =>
          void dispatch(startFastCutRequested({ id: "toolbar.fast-export", type: "button" }))
        }
        shortcut="Ctrl+S"
        tooltip={
          sourceReady && !fastCutAvailable
            ? t("export.messages.fastUnavailable")
            : t("export.tooltips.fast")
        }
      />
      <ExportActionButton
        disabled={!sourceReady}
        icon={<Settings2 aria-hidden="true" />}
        label={t("export.actions.optimized")}
        onClick={() =>
          void dispatch(
            openOptimizedExportDialog({ id: "toolbar.optimized-export", type: "button" }),
          )
        }
        shortcut="Ctrl+E"
        tooltip={t("export.tooltips.optimized")}
      />
    </div>
  );
}

function ExportActionButton({
  disabled,
  icon,
  label,
  onClick,
  shortcut,
  tooltip,
}: {
  disabled: boolean;
  icon: ReactNode;
  label: string;
  onClick: () => void;
  shortcut: string;
  tooltip: string;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-flex" tabIndex={disabled ? 0 : undefined}>
          <Button
            aria-keyshortcuts={shortcut}
            className="max-w-44"
            disabled={disabled}
            onClick={onClick}
            size="sm"
            type="button"
            variant="secondary"
          >
            {icon}
            <span className="truncate">{label}</span>
          </Button>
        </span>
      </TooltipTrigger>
      <TooltipContent>{tooltip}</TooltipContent>
    </Tooltip>
  );
}

export { ExportActions };
