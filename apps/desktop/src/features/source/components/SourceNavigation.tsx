import { ArrowLeft, ArrowRight } from "lucide-react";
import type { ComponentProps } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

import { useAppDispatch, useAppSelector } from "@/app/store/redux-hooks";
import {
  selectActiveInstanceId,
  selectEditingInstanceTopologyEntries,
} from "@/app/store/slices/editing-instances-slice";
import { navigateToEditingInstance } from "@/app/store/thunks/source-media-thunks";
import { cn } from "@/lib/class-names.utils";

function SourceNavigation({ className }: { className?: string }) {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const activeInstanceId = useAppSelector(selectActiveInstanceId);
  const entries = useAppSelector(selectEditingInstanceTopologyEntries);

  const activeIndex = entries.findIndex((entry) => entry.id === activeInstanceId);

  const previousLabel = t("source.tooltips.previousSource");
  const nextLabel = t("source.tooltips.nextSource");

  const navigate = (offset: -1 | 1) => {
    const target = entries[activeIndex + offset];
    if (target) void dispatch(navigateToEditingInstance(target.id));
  };

  return (
    <div className={cn("flex", className)}>
      <SourceNavigationButton
        aria-label={previousLabel}
        disabled={activeIndex <= 0}
        onClick={() => navigate(-1)}
        tooltip={previousLabel}
      >
        <ArrowLeft aria-hidden="true" />
      </SourceNavigationButton>

      <SourceNavigationButton
        aria-label={nextLabel}
        disabled={activeIndex < 0 || activeIndex >= entries.length - 1}
        onClick={() => navigate(1)}
        tooltip={nextLabel}
      >
        <ArrowRight aria-hidden="true" />
      </SourceNavigationButton>
    </div>
  );
}

function SourceNavigationButton({
  tooltip,
  ...props
}: ComponentProps<typeof Button> & {
  tooltip: string;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          className="text-muted-foreground hover:text-foreground"
          size="icon-sm"
          variant="ghost"
          {...props}
        />
      </TooltipTrigger>
      <TooltipContent>{tooltip}</TooltipContent>
    </Tooltip>
  );
}

export { SourceNavigation };
