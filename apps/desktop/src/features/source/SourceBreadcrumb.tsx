import { Children, type PropsWithChildren } from "react";

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
import type { EditingInstance } from "@/domain/editing-instance";

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
        <SourceBreadcrumbList>
          {directories.map((directory) => (
            <SourceBreadcrumbDirectory directory={directory} key={directory.path} />
          ))}

          <SourceBreadcrumbPage instance={instance} />
          <SourceBreadcrumbMore instance={instance} />
        </SourceBreadcrumbList>
      </BreadcrumbList>
    </Breadcrumb>
  );
}

function SourceBreadcrumbDirectory({ directory }: { directory: { name: string; path: string } }) {
  return (
    <BreadcrumbItem className="min-w-0">
      <BreadcrumbLink className="max-w-32 truncate" title={directory.path}>
        {directory.name}
      </BreadcrumbLink>
    </BreadcrumbItem>
  );
}

function SourceBreadcrumbPage({ instance }: { instance: EditingInstance }) {
  const { displayName } = instance.snapshot.source;
  const sourcePath = formatSourcePath(instance.snapshot.source.sourcePath);

  return (
    <BreadcrumbItem className="min-w-0">
      <BreadcrumbPage className="truncate" title={sourcePath}>
        {displayName}
      </BreadcrumbPage>
    </BreadcrumbItem>
  );
}

function SourceBreadcrumbMore({ instance }: { instance: EditingInstance }) {
  return (
    <BreadcrumbItem>
      <Popover>
        <PopoverTrigger asChild>
          <Button className="h-auto max-w-56 min-w-0 gap-0 p-0" size="xs" variant="link">
            <BreadcrumbEllipsis />
          </Button>
        </PopoverTrigger>

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
