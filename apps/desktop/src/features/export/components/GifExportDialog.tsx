import { Film } from "lucide-react";
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
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { useAppDispatch } from "@/app/store/redux-hooks";
import { startGifExportRequested } from "@/app/store/thunks/export-thunks";

const GIF_FRAME_RATES = [10, 15, 20, 24];
const GIF_WIDTHS = [320, 480, 640, 800];

function GifExportDialog({ disabled }: { disabled: boolean }) {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const [open, setOpen] = useState(false);
  const [width, setWidth] = useState(480);
  const [frameRate, setFrameRate] = useState(15);

  return (
    <Dialog onOpenChange={setOpen} open={open}>
      <DialogTrigger asChild>
        <Button
          className="max-2xl:size-7 max-2xl:gap-0 max-2xl:rounded-[min(var(--radius-md),0.75rem)] max-2xl:p-0"
          disabled={disabled}
          size="sm"
          type="button"
          variant="secondary"
        >
          <Film aria-hidden="true" />
          <span className="inline-flex items-center gap-1 truncate max-2xl:sr-only">
            {t("export.gif.action")}
          </span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("export.gif.dialog.title")}</DialogTitle>
          <DialogDescription>{t("export.gif.dialog.description")}</DialogDescription>
        </DialogHeader>

        <section className="grid gap-1.5">
          <Label htmlFor="gif-export-width">{t("export.resolution.widthLabel")}</Label>
          <Select onValueChange={(value) => setWidth(Number(value))} value={String(width)}>
            <SelectTrigger className="w-full" id="gif-export-width">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {GIF_WIDTHS.map((value) => (
                <SelectItem key={value} value={String(value)}>
                  {value} px
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </section>

        <section className="grid gap-1.5">
          <Label htmlFor="gif-export-frame-rate">{t("export.frameRate.label")}</Label>
          <Select onValueChange={(value) => setFrameRate(Number(value))} value={String(frameRate)}>
            <SelectTrigger className="w-full" id="gif-export-frame-rate">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {GIF_FRAME_RATES.map((value) => (
                <SelectItem key={value} value={String(value)}>
                  {t("export.frameRate.value", { value })}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </section>

        <DialogFooter>
          <Button onClick={() => setOpen(false)} variant="outline">
            {t("common.actions.cancel")}
          </Button>
          <Button
            onClick={() => {
              setOpen(false);
              void dispatch(
                startGifExportRequested({
                  frameRate: { denominator: 1, numerator: frameRate },
                  width,
                }),
              );
            }}
          >
            {t("export.actions.start")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export { GifExportDialog };
