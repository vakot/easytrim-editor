import { Children, type PropsWithChildren } from "react";
import { useTranslation } from "react-i18next";

import {
  Breadcrumb,
  BreadcrumbEllipsis,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

import { useAppSelector } from "@/app/store/redux-hooks";
import {
  selectActiveInstanceId,
  selectEditingInstanceTopologyEntries,
} from "@/app/store/slices/editing-instances-slice";
import { openFileLocation } from "@/lib/tauri/media";

import { formatSourcePath } from "../lib/media-formatters.utils";
import { getPathDirectories, getRevealLabel } from "../lib/source.utils";

import { SourceDetails } from "./SourceDetails";

interface SourceBreadcrumbProps {
  className?: string;
}

function SourceBreadcrumb({ className }: SourceBreadcrumbProps) {
  const activeInstanceId = useAppSelector(selectActiveInstanceId);
  const entries = useAppSelector(selectEditingInstanceTopologyEntries);
  const instance = entries.find((entry) => entry.id === activeInstanceId);

  if (!instance) return null;

  const sourcePath = formatSourcePath(instance.sourcePath);
  const directories = getPathDirectories(sourcePath);

  return (
    <Breadcrumb className={className}>
      <BreadcrumbList className="min-w-0 flex-nowrap overflow-hidden text-xs">
        <SourceBreadcrumbList>
          {directories.map((directory) => (
            <SourceBreadcrumbDirectory directory={directory} key={directory.path} />
          ))}

          <SourceBreadcrumbPage instance={instance} />
          <SourceBreadcrumbMore />
        </SourceBreadcrumbList>
      </BreadcrumbList>
    </Breadcrumb>
  );
}

function SourceBreadcrumbDirectory({ directory }: { directory: { name: string; path: string } }) {
  return (
    <BreadcrumbItem className="min-w-0">
      <SourceBreadcrumbAction
        className="max-w-32 truncate"
        path={directory.path}
        title={directory.path}
      >
        {directory.name}
      </SourceBreadcrumbAction>
    </BreadcrumbItem>
  );
}

function SourceBreadcrumbPage({
  instance,
}: {
  instance: { displayName: string; id: string; sourcePath: string };
}) {
  const { displayName } = instance;
  const sourcePath = formatSourcePath(instance.sourcePath);

  return (
    <BreadcrumbItem className="min-w-0">
      <SourceBreadcrumbAction className="max-w-56" path={instance.sourcePath} title={sourcePath}>
        {displayName}
      </SourceBreadcrumbAction>
    </BreadcrumbItem>
  );
}

function SourceBreadcrumbAction({
  children,
  className,
  path,
  title,
}: PropsWithChildren<{ className: string; path: string; title: string }>) {
  const { t } = useTranslation();
  const revealLabel = getRevealLabel(t);

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          className={`text-foreground-muted h-auto min-w-0 justify-baseline rounded-none p-0 font-normal hover:text-foreground ${className}`}
          onClick={() => void openFileLocation(path)}
          size="xs"
          title={title}
          type="button"
          variant="link"
        >
          <span className="truncate">{children}</span>
        </Button>
      </TooltipTrigger>
      <TooltipContent>{revealLabel}</TooltipContent>
    </Tooltip>
  );
}

function SourceBreadcrumbMore() {
  const { t } = useTranslation();

  return (
    <BreadcrumbItem>
      <Popover>
        <Tooltip>
          <TooltipTrigger asChild>
            <PopoverTrigger asChild>
              <Button
                aria-label={t("source.labels.technicalDetails")}
                className="h-auto max-w-56 min-w-0 gap-0 p-0"
                size="xs"
                variant="link"
              >
                <BreadcrumbEllipsis />
              </Button>
            </PopoverTrigger>
          </TooltipTrigger>
          <TooltipContent>{t("source.labels.technicalDetails")}</TooltipContent>
        </Tooltip>

        <PopoverContent align="start" className="w-80 p-2.5" side="bottom" sideOffset={5}>
          <SourceDetails />
        </PopoverContent>
      </Popover>
    </BreadcrumbItem>
  );
}

function SourceBreadcrumbList({ children }: PropsWithChildren) {
  return Children.toArray(children).flatMap((child, index) =>
    index === 0 ? [child] : [<BreadcrumbSeparator key={`breadcrumb-separator-${index}`} />, child],
  );
}

export { SourceBreadcrumb };
