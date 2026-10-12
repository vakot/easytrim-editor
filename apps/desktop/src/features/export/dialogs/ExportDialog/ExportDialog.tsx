import {
  type ComponentProps,
  createContext,
  type PropsWithChildren,
  Suspense,
  useContext,
  useEffect,
  useRef,
} from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import type { DialogScope } from "@/components/ui/dialog";
import {
  createDialogScope,
  Dialog,
  DialogContent,
  DialogTrigger,
} from "@/components/ui/dialog";

import { useAppDispatch, useAppSelector } from "@/app/store/redux-hooks";
import { selectExportDialogOpen, selectExportLaunchError } from "@/app/store/slices/export-slice";
import {
  cancelOptimizedExportDialogRequested,
  openOptimizedExportDialog,
} from "@/app/store/thunks/export-thunks";
import { localizeAppError } from "@/i18n/app-errors";
import { lazyWithPreload, preloadOnIntent } from "@/lib/lazy-component";
import type { DiagnosticOrigin } from "@/lib/tauri/diagnostics.types";

import type { ExportDialogContentProps } from "./ExportDialogContent";

const LazyExportDialogContent = lazyWithPreload<ExportDialogContentProps>(() =>
  import("./ExportDialogContent").then((module) => ({
    default: module.ExportDialogContent,
  })),
);

const useExportDialogScope = createDialogScope();

const ExportDialogOriginContext = createContext<((origin: DiagnosticOrigin) => void) | null>(null);

const ExportDialog = Object.assign(
  function ExportDialog({
    __scopeDialog,
    children,
  }: PropsWithChildren<{ __scopeDialog?: DialogScope }>) {
    const dialogScope = useExportDialogScope(__scopeDialog);
    const { t } = useTranslation();
    const dispatch = useAppDispatch();
    const open = useAppSelector(selectExportDialogOpen);
    const launchError = useAppSelector(selectExportLaunchError);
    const origin = useRef<DiagnosticOrigin>({ id: "toolbar.optimized-export", type: "button" });

    useEffect(() => {
      if (launchError) toast.error(localizeAppError(launchError, t));
    }, [launchError, t]);

    function handleOpenChange(nextOpen: boolean) {
      if (nextOpen) {
        void dispatch(openOptimizedExportDialog(origin.current));
      } else {
        dispatch(cancelOptimizedExportDialogRequested());
      }
    }

    return (
      <Dialog {...dialogScope} onOpenChange={handleOpenChange} open={open}>
        <ExportDialogOriginContext.Provider
          value={(nextOrigin) => {
            origin.current = nextOrigin;
          }}
        >
          {children}
          <DialogContent {...dialogScope} className="sm:max-w-xl">
            <Suspense fallback={null}>
              <LazyExportDialogContent
                __scopeDialog={dialogScope.__scopeDialog}
                onCancel={() => handleOpenChange(false)}
              />
            </Suspense>
          </DialogContent>
        </ExportDialogOriginContext.Provider>
      </Dialog>
    );
  },
  { preload: () => LazyExportDialogContent.preload() },
);

export { ExportDialog };

const preloadExportDialogOnIntent = preloadOnIntent(() => ExportDialog.preload());

function ExportDialogTrigger({
  __scopeDialog,
  onClick,
  onFocus,
  onPointerEnter,
  origin = { id: "toolbar.optimized-export", type: "button" },
  ...props
}: ComponentProps<typeof DialogTrigger> & {
  origin?: DiagnosticOrigin;
}) {
  const dialogScope = useExportDialogScope(__scopeDialog);
  const setOrigin = useContext(ExportDialogOriginContext);
  if (!setOrigin) throw new Error("ExportDialogTrigger must be used within ExportDialog");

  return (
    <DialogTrigger
      {...dialogScope}
      {...props}
      onClick={(event) => {
        onClick?.(event);
        setOrigin(origin);
      }}
      onFocus={(event) => {
        onFocus?.(event);
        preloadExportDialogOnIntent();
      }}
      onPointerEnter={(event) => {
        onPointerEnter?.(event);
        preloadExportDialogOnIntent();
      }}
    />
  );
}

export { ExportDialogTrigger };
