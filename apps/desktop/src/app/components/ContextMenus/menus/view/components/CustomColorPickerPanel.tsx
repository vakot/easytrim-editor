import { useState } from "react";
import { useTranslation } from "react-i18next";

import { SpectrumWheel } from "@/app/components/PrimaryColorSelector";
import { isCustomPrimaryColor, resolvePrimaryColor, type PrimaryColor } from "@/app/theme/theme";
import { useTheme } from "@/app/theme/use-theme";
import { Input } from "@/components/ui/input";

interface CustomColorPickerPanelProps {
  previewColor: PrimaryColor | null;
  onPreviewChange: (color: PrimaryColor | null) => void;
  onClose: () => void;
}

export function CustomColorPickerPanel({
  previewColor,
  onPreviewChange,
  onClose,
}: CustomColorPickerPanelProps) {
  const { t } = useTranslation();
  const { customPrimaryColor, previewPrimaryColor, setPrimaryColor } = useTheme();
  const [hexValue, setHexValue] = useState<string>(customPrimaryColor.slice(1));
  const selectedColor = resolvePrimaryColor(previewColor ?? customPrimaryColor);

  const preview = (color: PrimaryColor) => {
    onPreviewChange(color);
    setHexValue(resolvePrimaryColor(color).slice(1));
    previewPrimaryColor(color);
  };
  const commit = (color: PrimaryColor) => {
    onPreviewChange(null);
    setHexValue(resolvePrimaryColor(color).slice(1));
    setPrimaryColor(color);
  };
  const cancel = () => {
    onPreviewChange(null);
    setHexValue(customPrimaryColor.slice(1));
    previewPrimaryColor(null);
  };
  const updateHexValue = (value: string) => {
    setHexValue(value);
    const color = `#${value}`;
    if (isCustomPrimaryColor(color)) commit(color);
  };

  return (
    <div className="w-auto space-y-3 p-2" onPointerMove={(event) => event.stopPropagation()}>
      <SpectrumWheel
        color={selectedColor}
        onPreview={preview}
        onCommit={commit}
        onCancel={cancel}
      />
      <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
        <span>{t("themeColor.custom")}</span>
        <div className="flex h-6 w-15 items-center rounded-lg border border-input bg-transparent px-1.5 transition-colors focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50">
          <span
            aria-hidden="true"
            className="pointer-events-none select-none shrink-0 font-mono text-xs text-muted-foreground"
            data-slot="hex-prefix"
          >
            #
          </span>
          <Input
            aria-label={`${t("themeColor.custom")} hex`}
            className="h-full w-auto min-w-0 flex-1 rounded-none border-0 px-0 py-0 font-mono text-xs text-foreground shadow-none focus-visible:border-0 focus-visible:ring-0"
            maxLength={6}
            onChange={(event) =>
              updateHexValue(event.target.value.replace(/[^0-9a-fA-F]/g, "").slice(0, 6))
            }
            onClick={(event) => event.stopPropagation()}
            onKeyDown={(event) => {
              if (event.key !== "Enter") return;
              event.preventDefault();
              const color = `#${hexValue}`;
              if (isCustomPrimaryColor(color)) commit(color);
              onClose();
            }}
            onPointerDown={(event) => event.stopPropagation()}
            pattern="[0-9a-fA-F]{6}"
            spellCheck={false}
            value={hexValue}
          />
        </div>
      </div>
    </div>
  );
}
