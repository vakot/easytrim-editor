import { Fragment } from "react";

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

import { useAppSelector } from "@/app/store/redux-hooks";
import { selectActiveEditingInstance } from "@/app/store/slices/editing-instances-slice";

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
      </BreadcrumbList>
    </Breadcrumb>
  );
}
