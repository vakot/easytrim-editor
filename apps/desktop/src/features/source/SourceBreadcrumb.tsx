import { Fragment } from "react";

import {
  Breadcrumb,
  BreadcrumbEllipsis,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

import { useAppSelector } from "@/app/store/redux-hooks";
import { selectActiveEditingInstance } from "@/app/store/slices/editing-instances-slice";

import { SourceDetails } from "./components/SourceDetails";
import { formatSourcePath } from "./lib/media-formatters.utils";
import { getPathDirectories } from "./lib/source-tree.utils";

export function SourceBreadcrumb() {
  const instance = useAppSelector(selectActiveEditingInstance);

  if (!instance) return null;

  const sourcePath = formatSourcePath(instance.snapshot.source.sourcePath);
  const directories = getPathDirectories(sourcePath);

  return (
    <Breadcrumb className="min-w-0 px-2 pb-1">
      <BreadcrumbList className="flex-nowrap overflow-hidden text-xs">
        {directories.map((directory) => (
          <Fragment key={directory.path}>
            <BreadcrumbItem className="min-w-0">
              <BreadcrumbLink className="max-w-32 truncate" title={directory.path}>
                {directory.name}
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
          </Fragment>
        ))}

        <BreadcrumbItem className="min-w-0">
          <BreadcrumbPage className="truncate" title={sourcePath}>
            {instance.snapshot.source.displayName}
          </BreadcrumbPage>
        </BreadcrumbItem>

        <BreadcrumbSeparator />

        <BreadcrumbItem>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                className="h-auto max-w-56 min-w-0 gap-0 p-0"
                size="xs"
                title={sourcePath}
                variant="link"
              >
                <BreadcrumbEllipsis />
              </Button>
            </PopoverTrigger>

            <PopoverContent align="start" className="w-80 p-2.5" side="bottom" sideOffset={5}>
              <SourceDetails />
            </PopoverContent>
          </Popover>
        </BreadcrumbItem>
      </BreadcrumbList>
    </Breadcrumb>
  );
}
