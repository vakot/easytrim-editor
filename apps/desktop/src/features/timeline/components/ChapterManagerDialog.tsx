import { BookmarkPlus, Pencil, Trash2 } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

import { useAppDispatch, useAppSelector } from "@/app/store/redux-hooks";
import {
  chapterAdded,
  chapterDeleted,
  chapterUpdated,
  selectChapters,
} from "@/app/store/slices/chapters-slice";
import { selectSourceMedia, selectSourceSelection } from "@/app/store/slices/source-slice";
import { selectTrim } from "@/app/store/slices/trim-slice";
import type { EditorChapter } from "@/domain/media";
import { formatPlaybackTime } from "@/domain/playback";

function ChapterManagerDialog() {
  const source = useAppSelector(selectSourceSelection);
  return <ChapterManagerDialogContent key={source?.sourcePath ?? "no-source"} />;
}

function ChapterManagerDialogContent() {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const chapters = useAppSelector(selectChapters);
  const trim = useAppSelector(selectTrim);
  const media = useAppSelector(selectSourceMedia);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<EditorChapter | null>(null);
  const [error, setError] = useState(false);

  const beginCreate = () => {
    if (!trim) return;
    setError(false);
    setDraft({
      endMicros: trim.endMicros,
      id: crypto.randomUUID(),
      startMicros: trim.startMicros,
      title: "",
    });
  };

  const saveDraft = () => {
    if (
      !draft ||
      !draft.title.trim() ||
      draft.startMicros < 0 ||
      draft.endMicros <= draft.startMicros ||
      !media ||
      draft.endMicros > media.durationMicros
    ) {
      setError(true);
      return;
    }
    const chapter = { ...draft, title: draft.title.trim() };
    if (chapters.some(({ id }) => id === chapter.id)) dispatch(chapterUpdated(chapter));
    else dispatch(chapterAdded(chapter));
    setDraft(null);
    setError(false);
  };

  const startDraft = (chapter: EditorChapter) => {
    setError(false);
    setDraft({ ...chapter });
  };

  const setSeconds = (field: "startMicros" | "endMicros", value: string) => {
    const seconds = Number(value);
    setDraft((current) =>
      current && Number.isFinite(seconds)
        ? { ...current, [field]: Math.round(seconds * 1_000_000) }
        : current,
    );
  };

  return (
    <Dialog
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (!nextOpen) setDraft(null);
      }}
      open={open}
    >
      <DialogTrigger asChild>
        <Button
          aria-label={t("timeline.chapters.actions.manageChapters")}
          disabled={!trim}
          size="icon-sm"
          type="button"
          variant="secondary"
        >
          <BookmarkPlus />
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("timeline.chapters.title")}</DialogTitle>
          <DialogDescription>{t("timeline.chapters.description")}</DialogDescription>
        </DialogHeader>
        <div className="grid max-h-72 gap-2 overflow-y-auto">
          {chapters.map((chapter) => (
            <div className="flex items-center gap-2 rounded-md border p-2" key={chapter.id}>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm">{chapter.title}</div>
                <div className="font-mono text-xs text-muted-foreground">
                  {formatPlaybackTime(chapter.startMicros, undefined)} –{" "}
                  {formatPlaybackTime(chapter.endMicros, undefined)}
                </div>
              </div>
              <Button
                aria-label={t("timeline.chapters.actions.editChapter", {
                  title: chapter.title,
                })}
                onClick={() => startDraft(chapter)}
                size="icon-sm"
                type="button"
                variant="ghost"
              >
                <Pencil />
              </Button>
              <Button
                aria-label={t("timeline.chapters.actions.deleteChapter", {
                  title: chapter.title,
                })}
                onClick={() => dispatch(chapterDeleted(chapter.id))}
                size="icon-sm"
                type="button"
                variant="ghost"
              >
                <Trash2 />
              </Button>
            </div>
          ))}
          {chapters.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              {t("timeline.chapters.empty")}
            </p>
          ) : null}
          <DialogFooter>
            <Button disabled={!trim} onClick={beginCreate} type="button">
              <BookmarkPlus /> {t("timeline.chapters.actions.addChapter")}
            </Button>
          </DialogFooter>
        </div>
        <ChapterDraftDialog
          draft={draft}
          error={error}
          onCancel={() => setDraft(null)}
          onDraftChange={setDraft}
          onSave={saveDraft}
          onSetSeconds={setSeconds}
        />
      </DialogContent>
    </Dialog>
  );
}

interface ChapterDraftDialogProps {
  draft: EditorChapter | null;
  error: boolean;
  onCancel: () => void;
  onDraftChange: (draft: EditorChapter) => void;
  onSave: () => void;
  onSetSeconds: (field: "startMicros" | "endMicros", value: string) => void;
}

function ChapterDraftDialog({
  draft,
  error,
  onCancel,
  onDraftChange,
  onSave,
  onSetSeconds,
}: ChapterDraftDialogProps) {
  const { t } = useTranslation();

  return (
    <Dialog
      onOpenChange={(open) => {
        if (!open) onCancel();
      }}
      open={draft !== null}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{draft?.title || t("timeline.chapters.title")}</DialogTitle>
          <DialogDescription>{t("timeline.chapters.description")}</DialogDescription>
        </DialogHeader>
        {draft ? (
          <div className="grid gap-3">
            <label className="grid gap-1 text-xs text-muted-foreground">
              {t("timeline.chapters.fields.title")}
              <Input
                autoFocus
                maxLength={256}
                onChange={(event) => onDraftChange({ ...draft, title: event.target.value })}
                value={draft.title}
              />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="grid gap-1 text-xs text-muted-foreground">
                {t("timeline.chapters.fields.startSeconds")}
                <Input
                  min={0}
                  onChange={(event) => onSetSeconds("startMicros", event.target.value)}
                  step={0.001}
                  type="number"
                  value={(draft.startMicros / 1_000_000).toFixed(3)}
                />
              </label>
              <label className="grid gap-1 text-xs text-muted-foreground">
                {t("timeline.chapters.fields.endSeconds")}
                <Input
                  min={0}
                  onChange={(event) => onSetSeconds("endMicros", event.target.value)}
                  step={0.001}
                  type="number"
                  value={(draft.endMicros / 1_000_000).toFixed(3)}
                />
              </label>
            </div>
            {error ? (
              <p className="text-xs text-destructive">{t("timeline.chapters.status.invalid")}</p>
            ) : null}
            <DialogFooter>
              <Button onClick={onCancel} type="button" variant="outline">
                {t("common.actions.cancel")}
              </Button>
              <Button onClick={onSave} type="button">
                {t("common.actions.save")}
              </Button>
            </DialogFooter>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

export { ChapterManagerDialog };
