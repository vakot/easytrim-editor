import { ChevronRight, Ellipsis, Info, RotateCcw } from "lucide-react";
import { Children, type PropsWithChildren, useState } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuIcon,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

import { ActivityFeed } from "@/features/activity";
import { SourceTabs, SourceTree } from "@/features/source";
import { cn } from "@/lib/class-names.utils";

type PanelStateId = "activeSources" | "explorer" | "activityFeed";

type PanelsVisibility = Record<PanelStateId, boolean>;
type PanelsEditable = Record<PanelStateId, boolean>;

const DEFAULT_PANELS_EDITABLE: PanelsEditable = {
  activeSources: true,
  explorer: false,
  activityFeed: true,
};

const DEFAULT_PANELS_VISIBILITY: PanelsVisibility = {
  activeSources: true,
  explorer: true,
  activityFeed: true,
};

export function EditorSource() {
  const { t } = useTranslation();

  const panelLabels: Record<PanelStateId, string> = {
    activeSources: t("source.labels.activeSources"),
    explorer: t("source.labels.explorer"),
    activityFeed: t("app.labels.activityFeed"),
  };

  const panelTooltips: Record<PanelStateId, string> = {
    activeSources: "",
    explorer: "",
    activityFeed: t("app.tooltips.activityFeedPrivacy"),
  };

  const [panelsVisibility, setPanelsVisibility] = useState(DEFAULT_PANELS_VISIBILITY);

  const enabledPanelIds = (Object.keys(panelsVisibility) as PanelStateId[]).filter(
    (panelId) => panelsVisibility[panelId],
  );

  const isSingle = enabledPanelIds.length === 1;

  const title = isSingle ? panelLabels[enabledPanelIds[0]!] : t("source.labels.title");
  const tooltip = isSingle ? panelTooltips[enabledPanelIds[0]!] : null;

  const handlePanelChange = (panelStateId: string, visible: boolean) => {
    setPanelsVisibility((panelsVisibility) => ({ ...panelsVisibility, [panelStateId]: visible }));
  };

  return (
    <aside aria-label={title} className="relative flex size-full min-h-0 flex-col pt-3">
      <div className="flex justify-between pr-7">
        <h3
          className="mx-3 mb-1 font-heading text-xs font-bold tracking-[0.16em] text-primary uppercase"
          id="source-panel-title"
        >
          {title}
        </h3>

        <SourcePanelCollapsibleTooltip tooltip={tooltip} />
      </div>

      <DropdownMenu>
        <Tooltip>
          <TooltipTrigger asChild>
            <DropdownMenuTrigger asChild>
              <Button
                className="absolute top-1 right-3 text-secondary-foreground"
                size="icon-xs"
                variant="ghost"
              >
                <Ellipsis aria-hidden="true" />
              </Button>
            </DropdownMenuTrigger>
          </TooltipTrigger>
          <TooltipContent side="bottom">{t("source.tooltips.sidebarControls")}</TooltipContent>
        </Tooltip>
        <DropdownMenuContent>
          <DropdownMenuGroup>
            {Object.keys(panelLabels).map((panelId) => (
              <DropdownMenuCheckboxItem
                checked={panelsVisibility[panelId as PanelStateId]}
                disabled={!DEFAULT_PANELS_EDITABLE[panelId as PanelStateId]}
                keepOpen
                onCheckedChange={(checked) => handlePanelChange(panelId, checked)}
              >
                {t("app.actions.showPanel", {
                  panel: panelLabels[panelId as PanelStateId],
                })}
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            <DropdownMenuItem
              disabled={enabledPanelIds.length === 3}
              inset
              keepOpen
              onSelect={() => setPanelsVisibility(DEFAULT_PANELS_VISIBILITY)}
            >
              <DropdownMenuIcon>
                <RotateCcw aria-hidden="true" className="size-3" />
              </DropdownMenuIcon>
              {t("app.actions.resetLayout")}
            </DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>

      <SourcePanelsCollapsibeGroup>
        {panelsVisibility["activeSources"] && (
          <>
            <SourcePanelCollapsible isSingle={isSingle} label={panelLabels.activeSources}>
              <div className="w-full px-3">
                <SourceTabs background="card" className="w-full pb-1" orientation="vertical" />
              </div>
            </SourcePanelCollapsible>

            <Separator className="bg-foreground/10" />
          </>
        )}

        {panelsVisibility["explorer"] && (
          <SourcePanelCollapsible
            className="data-[state=open]:flex-1"
            isSingle={isSingle}
            label={panelLabels.explorer}
          >
            <ScrollArea className="min-h-0 flex-1 px-3">
              <SourceTree className="pb-1" />
            </ScrollArea>
          </SourcePanelCollapsible>
        )}

        {panelsVisibility["activityFeed"] && (
          <>
            <Separator className="bg-foreground/10" />

            <SourcePanelCollapsible
              className="max-h-75"
              isSingle={isSingle}
              label={panelLabels.activityFeed}
              tooltip={panelTooltips.activityFeed}
            >
              <ScrollArea className="min-h-0 flex-1 px-3 before:top-4">
                <ActivityFeed />
              </ScrollArea>
            </SourcePanelCollapsible>
          </>
        )}
      </SourcePanelsCollapsibeGroup>
    </aside>
  );
}

function SourcePanelsCollapsibeGroup({ children }: PropsWithChildren) {
  return Children.toArray(children).flatMap((child, index) =>
    index === 0
      ? [child]
      : [<Separator className="bg-foreground/10" key={`separator-${index}`} />, child],
  );
}

interface SourcePanelCollapsibleProps {
  children?: React.ReactNode;
  className?: string;
  isSingle?: boolean;
  label?: string;
  tooltip?: string | null;
}

function SourcePanelCollapsible({
  children,
  className,
  isSingle = false,
  label,
  tooltip,
}: SourcePanelCollapsibleProps) {
  return (
    <Collapsible className={cn("flex min-h-0 flex-col", className)} open={isSingle || undefined}>
      <SourcePanelCollapsibleTrigger isSingle={isSingle} label={label} tooltip={tooltip} />
      <CollapsibleContent className="flex min-h-0 w-full flex-1">{children}</CollapsibleContent>
    </Collapsible>
  );
}

function SourcePanelCollapsibleTrigger({
  isSingle = false,
  label,
  tooltip,
}: SourcePanelCollapsibleProps) {
  if (isSingle) return null;

  return (
    <div className="relative p-1">
      <CollapsibleTrigger asChild>
        <Button
          aria-label={label}
          className={cn(
            "group w-full justify-baseline px-2 text-secondary-foreground data-[state=open]:bg-transparent data-[state=open]:text-secondary-foreground",
            !!tooltip && "pr-7",
          )}
          size="sm"
          variant="ghost"
        >
          {!isSingle && <ChevronRight className="shrink-0 group-data-[state=open]:rotate-90" />}
          {label}
        </Button>
      </CollapsibleTrigger>

      <SourcePanelCollapsibleTooltip tooltip={tooltip} />
    </div>
  );
}

function SourcePanelCollapsibleTooltip({ tooltip }: SourcePanelCollapsibleProps) {
  if (!tooltip) return;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          aria-label={tooltip}
          className="absolute top-1.5 right-2"
          size="icon-xs"
          variant="ghost"
        >
          <Info aria-hidden="true" className="size-3.5 text-primary" />
        </Button>
      </TooltipTrigger>
      <TooltipContent>{tooltip}</TooltipContent>
    </Tooltip>
  );
}
