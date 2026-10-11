import { Suspense } from "react";

import { useAppSelector } from "@/app/store/redux-hooks";
import { selectExportDialogOpen } from "@/app/store/slices/export-slice";

import { LazyExportDialog } from "./export-dialog.loader";

function ExportDialogMount() {
  const isOpen = useAppSelector(selectExportDialogOpen);

  if (!isOpen) return null;

  return (
    <Suspense fallback={null}>
      <LazyExportDialog />
    </Suspense>
  );
}

export { ExportDialogMount };
