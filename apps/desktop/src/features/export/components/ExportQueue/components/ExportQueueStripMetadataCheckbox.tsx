import { useId } from "react";
import { useTranslation } from "react-i18next";

import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

import { useAppDispatch, useAppSelector } from "@/app/store/redux-hooks";
import {
  preferenceChanged,
  selectStripMetadataOnExport,
} from "@/app/store/slices/preferences-slice";

function ExportQueueStripMetadataCheckbox() {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const checked = useAppSelector(selectStripMetadataOnExport);
  const id = useId();

  return (
    <div className="flex items-center gap-2">
      <Checkbox
        checked={checked}
        id={id}
        onCheckedChange={(nextChecked) =>
          dispatch(
            preferenceChanged({
              key: "stripMetadataOnExport",
              enabled: nextChecked === true,
            }),
          )
        }
      />
      <Label className="text-sm font-normal text-muted-foreground" htmlFor={id}>
        {t("settings.preferences.editing.stripMetadata.commandLabel")}
      </Label>
    </div>
  );
}

export { ExportQueueStripMetadataCheckbox };
