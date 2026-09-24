import {
  Check,
  CircleAlert,
  CircleX,
  Clipboard,
  ExternalLink,
  FolderOpen,
  LoaderCircle,
  RotateCw,
} from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

import { useAppDispatch, useAppSelector } from "@/app/store/redux-hooks";
import { selectCapabilities } from "@/app/store/slices/source-slice";
import { checkMediaCapabilitiesRequested } from "@/app/store/thunks/source-media-thunks";
import { openExternalUrl } from "@/lib/open-external-url.utils";
import { openFileLocation } from "@/lib/tauri/media";
import type { BinaryCapability, MediaCapabilities } from "@/lib/tauri/media.types";

const INSTALL_COMMAND = "winget install --id Gyan.FFmpeg --exact";

function MediaToolsStatus({ presentation = "compact" }: { presentation?: "compact" | "startup" }) {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const capabilities = useAppSelector(selectCapabilities);
  const [rechecked, setRechecked] = useState(false);
  const isChecking = capabilities.status === "checking";
  const ready = capabilities.status === "ready" && allAvailable(capabilities.value);
  const partial =
    capabilities.status === "ready" &&
    !allAvailable(capabilities.value) &&
    (capabilities.value.ffmpeg.available || capabilities.value.ffprobe.available);

  const statusText = isChecking
    ? t("app.status.checkingTools")
    : capabilities.status === "failed"
      ? t("app.status.toolsFailed")
      : ready
        ? t("app.status.toolsReady")
        : partial
          ? t("app.status.toolsIssue")
          : t("app.status.toolsUnavailable");

  const unavailable = capabilities.status === "ready" && !ready;

  const trigger = (
    <Button
      aria-label={ready && presentation === "compact" ? t("app.status.toolsReady") : statusText}
      className={presentation === "compact" && ready ? "size-7 px-0" : "h-7 gap-1.5 px-2 text-xs"}
      data-no-drag="true"
      size="sm"
      variant={
        ready
          ? "success"
          : unavailable || capabilities.status === "failed"
            ? "destructive"
            : "outline"
      }
    >
      {isChecking ? (
        <LoaderCircle aria-hidden="true" className="size-3.5 animate-spin" />
      ) : ready ? (
        <span aria-hidden="true" className="bg-success-foreground size-1.5 rounded-full" />
      ) : partial ? (
        <CircleAlert aria-hidden="true" className="size-3.5" />
      ) : (
        <CircleX aria-hidden="true" className="size-3.5" />
      )}
      {presentation === "startup" || !ready ? <span>{statusText}</span> : null}
    </Button>
  );

  return (
    <Popover>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent align="center" className="w-88 max-w-[calc(100vw-1rem)] p-4" sideOffset={7}>
        <div className="grid min-w-0 gap-3">
          <div className="grid gap-1">
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-semibold">{t("app.labels.mediaTools")}</h2>
              <span
                className={
                  ready
                    ? "text-xs text-success"
                    : unavailable || capabilities.status === "failed"
                      ? "text-xs text-destructive"
                      : "text-xs text-muted-foreground"
                }
              >
                {isChecking
                  ? t("app.status.checking")
                  : ready
                    ? t("source.status.ready")
                    : partial
                      ? t("app.status.toolsIssue")
                      : capabilities.status === "failed"
                        ? t("app.status.toolsFailed")
                        : t("app.status.toolsUnavailable")}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              {capabilities.status === "failed"
                ? capabilities.error.message
                : ready
                  ? t("app.messages.mediaToolsReady")
                  : t("app.messages.mediaToolsUnavailable")}
            </p>
          </div>

          {capabilities.status === "ready" ? (
            <ul className="grid min-w-0 gap-2">
              <BinaryRow capability={capabilities.value.ffmpeg} label="FFmpeg" />
              <BinaryRow capability={capabilities.value.ffprobe} label="FFprobe" />
            </ul>
          ) : null}

          {unavailable ? (
            <section className="grid gap-2 border-t pt-3">
              <div className="grid gap-1">
                <h3 className="text-xs font-medium">{t("app.labels.installMediaTools")}</h3>
                <p className="text-xs text-muted-foreground">
                  {partial
                    ? t("app.messages.mediaToolsTogether")
                    : t("app.messages.installMediaTools")}
                </p>
              </div>
              <div className="flex min-w-0 items-center gap-2 rounded-md border bg-muted/50 px-2 py-1.5">
                <code className="min-w-0 flex-1 truncate font-mono text-xs" title={INSTALL_COMMAND}>
                  {INSTALL_COMMAND}
                </code>
                <Button
                  aria-label={t("app.actions.copyInstallCommand")}
                  onClick={() =>
                    void copyText(
                      INSTALL_COMMAND,
                      t("app.messages.copied"),
                      t("app.messages.copyFailed"),
                    )
                  }
                  size="xs"
                  variant="ghost"
                >
                  <Clipboard aria-hidden="true" />
                  {t("app.actions.copy")}
                </Button>
              </div>
              {rechecked && unavailable ? (
                <p className="text-xs text-muted-foreground">
                  {t("app.messages.mediaToolsRestart")}
                </p>
              ) : null}
            </section>
          ) : null}

          <div className="flex items-center justify-between gap-2 border-t pt-3">
            {unavailable ? (
              <Button
                onClick={() => void openExternalUrl("https://ffmpeg.org/download.html")}
                size="sm"
                variant="link"
              >
                {t("app.actions.ffmpegDownloads")}
                <ExternalLink aria-hidden="true" />
              </Button>
            ) : (
              <span />
            )}
            <Button
              disabled={isChecking}
              onClick={() => {
                setRechecked(true);
                void dispatch(
                  checkMediaCapabilitiesRequested({ type: "button", id: "media-tools.recheck" }),
                );
              }}
              size="sm"
              variant="outline"
            >
              <RotateCw aria-hidden="true" className={isChecking ? "animate-spin" : undefined} />
              {isChecking ? t("app.status.checking") : t("app.actions.recheck")}
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function BinaryRow({ capability, label }: { capability: BinaryCapability; label: string }) {
  const { t } = useTranslation();

  function showInFolder(path: string) {
    void openFileLocation(path).catch(() => toast.error(t("app.messages.locationOpenFailed")));
  }

  return (
    <li className="grid min-w-0 gap-0.5">
      <div className="flex min-w-0 items-center gap-1.5 text-xs">
        {capability.available ? (
          <Check aria-hidden="true" className="size-3.5 text-success" />
        ) : (
          <CircleX aria-hidden="true" className="size-3.5 text-destructive" />
        )}
        <span className="shrink-0 font-medium">{label}</span>
        <span className="min-w-0 flex-1 truncate text-muted-foreground" title={capability.version}>
          {capability.version ??
            (capability.available ? t("app.status.installed") : t("app.status.missing"))}
        </span>
      </div>
      {capability.path ? (
        <div className="flex min-w-0 items-center gap-1 pl-5">
          <code
            className="min-w-0 flex-1 truncate font-mono text-[0.7rem] text-muted-foreground select-text"
            title={capability.path}
          >
            {capability.path}
          </code>
          <Button
            aria-label={t("app.actions.copyPath", { label })}
            onClick={() =>
              void copyText(
                capability.path!,
                t("app.messages.copied"),
                t("app.messages.copyFailed"),
              )
            }
            size="icon-xs"
            title={t("app.actions.copyPath", { label })}
            variant="ghost"
          >
            <Clipboard aria-hidden="true" />
          </Button>
          <Button
            aria-label={t("app.actions.showPathInFolder", { label })}
            onClick={() => showInFolder(capability.path!)}
            size="icon-xs"
            title={t("app.actions.showPathInFolder", { label })}
            variant="ghost"
          >
            <FolderOpen aria-hidden="true" />
          </Button>
        </div>
      ) : null}
      {!capability.available && capability.error ? (
        <span className="pl-5 text-xs text-muted-foreground">{capability.error}</span>
      ) : null}
    </li>
  );
}

async function copyText(value: string, confirmation: string, failure: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(value);
    toast.success(confirmation);
  } catch {
    toast.error(failure);
  }
}

function allAvailable(capabilities: MediaCapabilities): boolean {
  return capabilities.ffmpeg.available && capabilities.ffprobe.available;
}

export { MediaToolsStatus };
