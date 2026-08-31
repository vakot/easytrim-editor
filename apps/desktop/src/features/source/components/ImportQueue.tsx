import { ChevronLeft, ChevronRight, Trash, X } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import { Card, CardAction, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

import { useTimeline } from "@/app/hooks/useTimeline";
import type { importQueueItem } from "@/app/store/slices/export-slice";
import { editorSnapshotTrimStart } from "@/domain/editor-snapshot";
import { cn } from "@/lib/class-names.utils";
import { restoreSourceFromTrash } from "@/lib/tauri/media";
import { normalizeAppError } from "@/lib/tauri/media.utils";

import { useImportQueue } from "../hooks/useImportQueue";

import { DeleteSourceDialog } from "./DeleteSourceDialog";

function ToastFilePath({ sourcePath }: { sourcePath: string }) {
  return (
    <span className="block max-w-full truncate" dir="rtl" title={sourcePath}>
      {sourcePath}
    </span>
  );
}

export function ImportQueue() {
  const { t } = useTranslation();

  const { activeIndex, activeItem, deleteSource, items, next, prev, skip } = useImportQueue();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletePending, setDeletePending] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleteItemId, setDeleteItemId] = useState<string | null>(null);
  const deleteItem = items.find((item) => item.id === deleteItemId);

  const handleDeleteSource = async () => {
    if (!deleteItemId) return;

    const item = items.find((candidate) => candidate.id === deleteItemId);
    if (!item) return;

    const filename = item.snapshot.source.displayName;
    const sourcePath = item.snapshot.source.sourcePath;
    const normalizedSourcePath = formatSourcePath(sourcePath);

    setDeletePending(true);
    setDeleteError(null);

    let restorePending = false;
    const deleteToastId = `import-delete-${deleteItemId}-${Date.now()}`;

    const restore = async () => {
      if (restorePending) return;

      restorePending = true;
      toast.loading(t("queue.messages.fileRestore.loading", { filename }), {
        action: null,
        description: <ToastFilePath sourcePath={normalizedSourcePath} />,
        id: deleteToastId,
      });

      try {
        await restoreSourceFromTrash(sourcePath);
        toast.success(t("queue.messages.fileRestore.success"), {
          action: null,
          description: <ToastFilePath sourcePath={normalizedSourcePath} />,
          id: deleteToastId,
        });
      } catch (error: unknown) {
        const normalized = normalizeAppError(error);
        toast.error(
          t("queue.messages.fileRestore.error", {
            filename,
            message: normalized.message,
          }),
          {
            action: {
              label: t("app.actions.restore"),
              onClick: (event) => {
                event.preventDefault();
                void restore();
              },
            },
            description: <ToastFilePath sourcePath={normalizedSourcePath} />,
            id: deleteToastId,
          },
        );
      } finally {
        restorePending = false;
      }
    };

    const deleteOperation = deleteSource(deleteItemId).then((error) => {
      if (error) throw error;
    });

    toast.promise(deleteOperation, {
      description: <ToastFilePath sourcePath={normalizedSourcePath} />,
      error: (error: unknown) => {
        const normalized = normalizeAppError(error);
        return t("queue.messages.fileDelete.error", {
          filename,
          message: normalized.message,
        });
      },
      loading: t("queue.messages.fileDelete.loading", { filename }),
      success: () => ({
        action: {
          label: t("app.actions.restore"),
          onClick: (event) => {
            event.preventDefault();
            void restore();
          },
        },
        description: <ToastFilePath sourcePath={normalizedSourcePath} />,
        message: t("queue.messages.fileDelete.success"),
      }),
      id: deleteToastId,
    });

    try {
      await deleteOperation;
      setDeleteDialogOpen(false);
    } catch (error: unknown) {
      setDeleteError(normalizeAppError(error).message);
    } finally {
      setDeletePending(false);
    }
  };

  const openDeleteDialog = (itemId: string) => {
    setDeleteItemId(itemId);
    setDeleteError(null);
    setDeleteDialogOpen(true);
  };

  return (
    <section aria-labelledby="import-queue-title">
      <h2 className="sr-only" id="import-queue-title">
        {t("queue.labels.import")}
      </h2>

      <div className="sticky top-0 flex gap-2 bg-card pb-2">
        <ButtonGroup className="flex-1">
          <Button disabled={activeIndex <= 0} onClick={prev} size="sm" variant="outline">
            <ChevronLeft aria-hidden="true" />
            {t("queue.actions.previous")}
          </Button>
          <Button
            disabled={activeIndex < 0 || activeIndex >= items.length - 1}
            onClick={next}
            size="sm"
            variant="outline"
          >
            {t("queue.actions.next")}
            <ChevronRight aria-hidden="true" />
          </Button>
        </ButtonGroup>

        <Button disabled={activeIndex < 0} onClick={skip} size="sm" variant="outline">
          {t("queue.actions.skip")}
        </Button>
        <Button
          aria-label={t("queue.accessibility.deleteSource", {
            filename: activeItem?.snapshot.source.displayName,
          })}
          disabled={!activeItem}
          onClick={(event) => {
            event.stopPropagation();
            if (!activeItem) return;
            openDeleteDialog(activeItem?.id);
          }}
          size="icon-sm"
          type="button"
          variant="destructive"
        >
          <Trash aria-hidden="true" />
        </Button>
      </div>

      {deleteItem ? (
        <DeleteSourceDialog
          error={deleteError}
          onConfirm={() => void handleDeleteSource()}
          onOpenChange={setDeleteDialogOpen}
          open={deleteDialogOpen}
          pending={deletePending}
          sourceName={deleteItem.snapshot.source.displayName}
        />
      ) : null}

      {items.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border px-3 py-4 text-sm text-muted-foreground">
          {t("common.status.empty")}
        </p>
      ) : (
        <div aria-live="polite" className="grid gap-2 pb-2" role="status">
          {items.map((item) => (
            <ImportQueueItem
              active={item.id === activeItem?.id}
              item={item}
              key={item.id}
              onDelete={openDeleteDialog}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function ImportQueueItem({
  active,
  item,
  onDelete,
}: {
  active: boolean;
  item: importQueueItem;
  onDelete: (itemId: string) => void;
}) {
  const { t } = useTranslation();

  const timeline = useTimeline();
  const { open, remove } = useImportQueue();
  const sourcePath = formatSourcePath(item.snapshot.source.sourcePath);

  async function restoreItem() {
    open(item.id);
    timeline.onSeek(editorSnapshotTrimStart(item.snapshot.trim));
  }

  return (
    <Card
      aria-label={t("queue.accessibility.restoreItem", {
        filename: item.snapshot.source.displayName,
      })}
      className={cn(
        "border-l-4 transition-colors ring-inset hover:bg-muted/60",
        active && "border-l-primary",
      )}
      onClick={() => void restoreItem()}
      size="sm"
    >
      <CardHeader>
        <CardTitle className="truncate">{item.snapshot.source.displayName}</CardTitle>
        <CardDescription className="truncate">{sourcePath}</CardDescription>
        <CardAction>
          <ButtonGroup>
            <Button
              aria-label={t("queue.accessibility.removeImportItem", {
                filename: item.snapshot.source.displayName,
              })}
              onClick={(event) => {
                event.stopPropagation();
                remove(item.id);
              }}
              size="icon"
              type="button"
              variant="destructive"
            >
              <X aria-hidden="true" />
            </Button>
            <Button
              aria-label={t("queue.accessibility.deleteSource", {
                filename: item.snapshot.source.displayName,
              })}
              onClick={(event) => {
                event.stopPropagation();
                onDelete(item.id);
              }}
              size="icon"
              type="button"
              variant="destructive"
            >
              <Trash aria-hidden="true" />
            </Button>
          </ButtonGroup>
        </CardAction>
      </CardHeader>
    </Card>
  );
}

function formatSourcePath(sourcePath: string): string {
  const extendedPathPrefix = "\\\\?\\";
  return sourcePath.startsWith(extendedPathPrefix)
    ? sourcePath.slice(extendedPathPrefix.length)
    : sourcePath;
}
