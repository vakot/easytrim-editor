import { Settings } from "lucide-react";
import type { ComponentProps } from "react";
import { useTranslation } from "react-i18next";

import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";

import { cn } from "@/lib/class-names.utils";

function AudioTrackEffectsLibraryPage({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn("space-y-4", className)}
      data-slot="audio-track-effects-library-page"
      {...props}
    />
  );
}

function AudioTrackEffectsLibraryPageHeader({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn("flex items-start justify-between gap-4 border-b pb-3", className)}
      data-slot="audio-track-effects-library-page-header"
      {...props}
    />
  );
}

function AudioTrackEffectsLibraryPageHeaderContent({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn("min-w-0", className)}
      data-slot="audio-track-effects-library-page-header-content"
      {...props}
    />
  );
}

function AudioTrackEffectsLibraryPageTitle({ className, ...props }: ComponentProps<"h3">) {
  return (
    <h3
      className={cn("font-semibold", className)}
      data-slot="audio-track-effects-library-page-title"
      {...props}
    />
  );
}

function AudioTrackEffectsLibraryPageDescription({ className, ...props }: ComponentProps<"p">) {
  return (
    <p
      className={cn("mt-1 text-sm text-muted-foreground", className)}
      data-slot="audio-track-effects-library-page-description"
      {...props}
    />
  );
}

function AudioTrackEffectsLibraryPageToggle({
  className,
  ...props
}: ComponentProps<typeof Switch>) {
  return (
    <Switch
      className={cn("shrink-0", className)}
      data-slot="audio-track-effects-library-page-toggle"
      {...props}
    />
  );
}

/**
 * Wraps the editable portion of an Effects Library page.
 *
 * Uses native `<fieldset disabled>` semantics so standard form controls
 * rendered by shadcn primitives are disabled automatically without propagating
 * a `disabled` prop through the component tree.
 *
 * Interactive descendants are expected to use shadcn form primitives backed
 * by native form controls. Non-form interactive elements are outside this
 * component's contract.
 *
 * Keep page-level controls that must remain interactive while the effect is
 * disabled, such as the enable switch or analysis actions, outside this wrapper.
 */
function AudioTrackEffectsLibraryPageContent({
  className,
  ...props
}: React.ComponentProps<"fieldset">) {
  return (
    <fieldset
      className={cn(
        "min-w-0 space-y-4 border-0 p-0 transition-opacity disabled:pointer-events-none disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}

function AudioTrackEffectsLibraryPageBasic({ className, ...props }: ComponentProps<"section">) {
  return (
    <section
      className={cn("space-y-3", className)}
      data-slot="audio-track-effects-library-page-basic"
      {...props}
    />
  );
}

function AudioTrackEffectsLibraryPageAdvanced({
  children,
  className,
  ...props
}: ComponentProps<"section">) {
  const { t } = useTranslation();
  return (
    <>
      <div
        className="flex items-center gap-3"
        data-slot="audio-track-effects-library-page-advanced-header"
      >
        <h4 className="flex shrink-0 items-center gap-1 text-sm font-medium text-muted-foreground">
          <Settings />
          <span>{t("audio.tracks.labels.advanced")}</span>
        </h4>
        <Separator className="flex-1" />
      </div>

      <section
        className={cn("space-y-3", className)}
        data-slot="audio-track-effects-library-page-advanced"
        {...props}
      >
        {children}
      </section>
    </>
  );
}

export {
  AudioTrackEffectsLibraryPage,
  AudioTrackEffectsLibraryPageAdvanced,
  AudioTrackEffectsLibraryPageBasic,
  AudioTrackEffectsLibraryPageContent,
  AudioTrackEffectsLibraryPageDescription,
  AudioTrackEffectsLibraryPageHeader,
  AudioTrackEffectsLibraryPageHeaderContent,
  AudioTrackEffectsLibraryPageTitle,
  AudioTrackEffectsLibraryPageToggle,
};
