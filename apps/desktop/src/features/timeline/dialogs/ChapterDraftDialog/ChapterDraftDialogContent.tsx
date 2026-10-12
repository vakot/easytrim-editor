import { useState } from "react";
import { useTranslation } from "react-i18next";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { useAppDispatch, useAppSelector } from "@/app/store/redux-hooks";
import { chapterAdded, chapterUpdated, selectChapters } from "@/app/store/slices/chapters-slice";
import { selectSourceMedia } from "@/app/store/slices/source-slice";

import { useChapterDraft } from "./ChapterDraftDialogContext";

function ChapterDraftDialogContent() {
  const { t } = useTranslation();
  const { draft, setDraft } = useChapterDraft();
  const [error, setError] = useState(false);

  const dispatch = useAppDispatch();
  const chapters = useAppSelector(selectChapters);
  const media = useAppSelector(selectSourceMedia);

  const handleSave = (event: React.MouseEvent<HTMLButtonElement>) => {
    if (
      !draft.title.trim() ||
      draft.startMicros < 0 ||
      draft.endMicros <= draft.startMicros ||
      !media ||
      draft.endMicros > media.durationMicros
    ) {
      event.preventDefault();
      setError(true);
      return;
    }

    const chapter = { ...draft, title: draft.title.trim() };
    if (chapters.some(({ id }) => id === chapter.id)) dispatch(chapterUpdated(chapter));
    else dispatch(chapterAdded(chapter));
    setError(false);
  };

  const setSeconds = (field: "startMicros" | "endMicros", value: string) => {
    const seconds = Number(value);
    setDraft((current) =>
      Number.isFinite(seconds) ? { ...current, [field]: Math.round(seconds * 1_000_000) } : current,
    );
  };

  return (
    <DialogContent className="sm:max-w-lg">
      <DialogHeader>
        <DialogTitle>{draft.title || t("timeline.chapters.title")}</DialogTitle>
        <DialogDescription>{t("timeline.chapters.description")}</DialogDescription>
      </DialogHeader>

      <div className="grid gap-1">
        <Label className="text-xs text-muted-foreground" htmlFor="chapter-title">
          {t("timeline.chapters.fields.title")}
        </Label>
        <Input
          autoFocus
          id="chapter-title"
          maxLength={256}
          onChange={(event) => setDraft({ ...draft, title: event.target.value })}
          value={draft.title}
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="grid gap-1">
          <Label className="text-xs text-muted-foreground" htmlFor="chapter-start-seconds">
            {t("timeline.chapters.fields.startSeconds")}
          </Label>
          <Input
            id="chapter-start-seconds"
            min={0}
            onChange={(event) => setSeconds("startMicros", event.target.value)}
            step={0.001}
            type="number"
            value={(draft.startMicros / 1_000_000).toFixed(3)}
          />
        </div>
        <div className="grid gap-1">
          <Label className="text-xs text-muted-foreground" htmlFor="chapter-end-seconds">
            {t("timeline.chapters.fields.endSeconds")}
          </Label>
          <Input
            id="chapter-end-seconds"
            min={0}
            onChange={(event) => setSeconds("endMicros", event.target.value)}
            step={0.001}
            type="number"
            value={(draft.endMicros / 1_000_000).toFixed(3)}
          />
        </div>

        {error ? (
          <Alert variant="destructive">
            <AlertDescription>{t("timeline.chapters.status.invalid")}</AlertDescription>
          </Alert>
        ) : null}

        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline">
              {t("common.actions.cancel")}
            </Button>
          </DialogClose>
          <DialogClose asChild>
            <Button onClick={handleSave} type="button">
              {t("common.actions.save")}
            </Button>
          </DialogClose>
        </DialogFooter>
      </div>
    </DialogContent>
  );
}

export { ChapterDraftDialogContent };
