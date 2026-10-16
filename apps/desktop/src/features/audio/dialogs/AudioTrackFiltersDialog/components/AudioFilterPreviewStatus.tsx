import type { TFunction } from "i18next";
import { CircleAlert } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { Spinner } from "@/components/ui/spinner";

import { useAppSelector } from "@/app/store/redux-hooks";
import {
  type AudioFilterPreviewStatus as PreviewStatus,
  selectAudioFilterPreviewStatus,
} from "@/app/store/slices/audio-slice";

/** A status is shown only once it has lasted this long, so quick updates never flash. */
const STATUS_SETTLE_MS = 200;
/** Progress that was shown stays at least this long before the preview reads as ready. */
const MIN_PROGRESS_DISPLAY_MS = 600;

const STATUS_LABELS: Record<PreviewStatus, (t: TFunction) => string> = {
  active: (t) => t("audio.filters.preview.active"),
  analyzing: (t) => t("audio.filters.preview.analyzing"),
  preparing: (t) => t("audio.filters.preview.preparing"),
  unavailable: (t) => t("audio.filters.preview.unavailable"),
  updating: (t) => t("audio.filters.preview.updating"),
};

const isProgress = (status: PreviewStatus) =>
  status === "analyzing" || status === "preparing" || status === "updating";

/** The readiness of the whole live preview, in the place of the Apply instruction. */
function AudioFilterPreviewStatus() {
  const { t } = useTranslation();
  const status = useSettledStatus(useAppSelector(selectAudioFilterPreviewStatus) ?? "active");

  return (
    <p
      aria-live="polite"
      className="flex min-w-0 flex-1 items-center gap-1.5 text-xs text-muted-foreground"
      data-status={status}
      role="status"
    >
      {isProgress(status) ? <Spinner aria-hidden="true" className="size-3.5 shrink-0" /> : null}
      {status === "unavailable" ? (
        <CircleAlert aria-hidden="true" className="size-3.5 shrink-0 text-destructive" />
      ) : null}
      <span className="min-w-0 truncate">{STATUS_LABELS[status](t)}</span>
    </p>
  );
}

function useSettledStatus(status: PreviewStatus): PreviewStatus {
  const [shown, setShown] = useState<PreviewStatus>(isProgress(status) ? "active" : status);
  const shownAt = useRef(0);

  useEffect(() => {
    if (status === shown) return;
    const remaining = isProgress(shown)
      ? MIN_PROGRESS_DISPLAY_MS - (performance.now() - shownAt.current)
      : 0;

    const timer = window.setTimeout(
      () => {
        shownAt.current = performance.now();
        setShown(status);
      },
      Math.max(STATUS_SETTLE_MS, remaining),
    );

    return () => window.clearTimeout(timer);
  }, [shown, status]);

  return shown;
}

export { AudioFilterPreviewStatus };
