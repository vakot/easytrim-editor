import { cva } from "class-variance-authority";
import type { TFunction } from "i18next";
import {
  Check,
  CircleAlert,
  CircleCheck,
  CircleX,
  Clipboard,
  ExternalLink,
  FolderOpen,
  LoaderCircle,
  RotateCw,
} from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { createContext, useContext, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";

import { useAppDispatch, useAppSelector } from "@/app/store/redux-hooks";
import { selectCapabilities } from "@/app/store/slices/source-slice";
import { checkMediaCapabilitiesRequested } from "@/app/store/thunks/source-media-thunks";
import { cn } from "@/lib/class-names.utils";
import { openExternalUrl } from "@/lib/open-external-url.utils";
import { openFileLocation } from "@/lib/tauri/media";
import type { BinaryCapability, MediaCapabilities } from "@/lib/tauri/media.types";

const INSTALL_COMMAND = "winget install --id Gyan.FFmpeg --exact";

const triggerButtonVariants = cva("shrink-0 gap-0 border-l! px-2 transition-colors", {
  variants: {
    variant: {
      outline: "",
      destructive: "border-destructive/40",
      success: "border-success/40",
    },
  },
  defaultVariants: {
    variant: "outline",
  },
});

interface MediaToolsStatusProps {
  children?: React.ReactNode;
}

function MediaToolsStatus({ children }: MediaToolsStatusProps) {
  const capabilities = useAppSelector(selectCapabilities);
  const state = getMediaToolsState(capabilities);

  const [open, setOpen] = useState(false);

  return (
    <MediaToolsStatusContext.Provider value={{ capabilities, state }}>
      <Popover onOpenChange={setOpen} open={open}>
        {children}
      </Popover>
    </MediaToolsStatusContext.Provider>
  );
}

function MediaToolsStatusTrigger({
  className,
  presentation,
}: {
  className?: string;
  presentation: "compact" | "default";
}) {
  const { t } = useTranslation();

  const { capabilities, state } = useMediaToolsStatus();

  const { checking, partial, ready, unavailable } = state;
  const shouldReduceMotion = useReducedMotion();

  const iconOnly = presentation === "compact" && ready;

  const statusText = checking
    ? t("app.status.checkingTools")
    : presentation === "default" && ready
      ? t("app.status.toolsReady")
      : getStatusText(state, t);

  const variant = ready
    ? "success"
    : unavailable || capabilities.status === "failed"
      ? "destructive"
      : "outline";

  const duration = shouldReduceMotion ? 0 : 0.3;

  return (
    <PopoverTrigger asChild>
      <Button
        aria-label={iconOnly ? t("app.status.toolsReady") : statusText}
        className={cn(triggerButtonVariants({ variant }), className)}
        data-no-drag="true"
        size="xs"
        variant={variant}
      >
        {checking ? (
          <LoaderCircle aria-hidden="true" className="size-3.5 animate-spin" />
        ) : ready ? (
          <CircleCheck aria-hidden="true" className="size-3.5" />
        ) : partial ? (
          <CircleAlert aria-hidden="true" className="size-3.5" />
        ) : (
          <CircleX aria-hidden="true" className="size-3.5" />
        )}

        <motion.span
          animate={{
            opacity: iconOnly ? 0 : 1,
            width: iconOnly ? 0 : "auto",
            marginLeft: iconOnly ? 0 : 6,
          }}
          aria-hidden={iconOnly}
          className="min-w-0 shrink-0 overflow-hidden whitespace-nowrap"
          initial={false}
          transition={{ duration, ease: "easeOut" }}
        >
          {statusText}
        </motion.span>
      </Button>
    </PopoverTrigger>
  );
}

function MediaToolsStatusContent({ className }: { className?: string }) {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const [rechecked, setRechecked] = useState(false);

  const { capabilities, state } = useMediaToolsStatus();

  const { checking, partial, ready, unavailable } = state;

  return (
    <PopoverContent align="center" className={className} sideOffset={4}>
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
              {getStatusText(state, t)}
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
              <p className="text-xs text-muted-foreground">{t("app.messages.mediaToolsRestart")}</p>
            ) : null}
          </section>
        ) : null}

        <Separator />

        <div className="flex items-center justify-between gap-2">
          {unavailable ? (
            <Button
              onClick={() => void openExternalUrl("https://ffmpeg.org/download.html")}
              size="xs"
              variant="link"
            >
              {t("app.actions.ffmpegDownloads")}
              <ExternalLink aria-hidden="true" />
            </Button>
          ) : (
            <span />
          )}
          <Button
            disabled={checking}
            onClick={() => {
              setRechecked(true);
              void dispatch(
                checkMediaCapabilitiesRequested({ type: "button", id: "media-tools.recheck" }),
              );
            }}
            size="xs"
            variant="outline"
          >
            <RotateCw aria-hidden="true" className={checking ? "animate-spin" : undefined} />
            {checking ? t("app.status.checking") : t("app.actions.recheck")}
          </Button>
        </div>
      </div>
    </PopoverContent>
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

type MediaToolsState = {
  checking: boolean;
  failed: boolean;
  partial: boolean;
  ready: boolean;
  unavailable: boolean;
};

const MediaToolsStatusContext = createContext<{
  capabilities: ReturnType<typeof selectCapabilities>;
  state: MediaToolsState;
} | null>(null);

function useMediaToolsStatus() {
  const context = useContext(MediaToolsStatusContext);
  if (!context) {
    throw new Error(
      "MediaToolsStatusTrigger and MediaToolsStatusContent should be used within MediaToolsStatus",
    );
  }
  return context;
}

function getMediaToolsState(capabilities: ReturnType<typeof selectCapabilities>): MediaToolsState {
  const ready = capabilities.status === "ready" && allAvailable(capabilities.value);
  const partial =
    capabilities.status === "ready" &&
    !ready &&
    (capabilities.value.ffmpeg.available || capabilities.value.ffprobe.available);

  return {
    checking: capabilities.status === "checking",
    failed: capabilities.status === "failed",
    partial,
    ready,
    unavailable: capabilities.status === "ready" && !ready,
  };
}

function getStatusText(state: MediaToolsState, t: TFunction): string {
  if (state.checking) return t("app.status.checking");
  if (state.ready) return t("app.status.toolsReady");
  if (state.partial) return t("app.status.toolsIssue");
  if (state.failed) return t("app.status.toolsFailed");
  return t("app.status.toolsUnavailable");
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

export { MediaToolsStatus, MediaToolsStatusContent, MediaToolsStatusTrigger };
