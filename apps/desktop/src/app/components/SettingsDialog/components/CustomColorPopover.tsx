import { createContext, useContext, useState } from "react";
import { useTranslation } from "react-i18next";

import { ColorSpectrum } from "@/components/ui/color";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

import { useAppDispatch } from "@/app/store/redux-hooks";
import { customPrimaryColorChanged } from "@/app/store/slices/preferences-slice";
import {
  type CustomPrimaryColor,
  isCustomPrimaryColor,
  type PrimaryColor,
  resolvePrimaryColor,
} from "@/app/theme/theme";
import { useTheme } from "@/app/theme/useTheme";
import { cn } from "@/lib/class-names.utils";

function CustomColorPopover({
  children,
  value,
  ...props
}: Omit<React.ComponentProps<typeof Popover>, "open" | "onOpenChange"> & {
  value: CustomPrimaryColor;
}) {
  const { finishPrimaryColorPreview, previewPrimaryColor } = useTheme();
  const dispatch = useAppDispatch();

  const [open, setOpen] = useState(false);
  const [session, setSession] = useState(() => createEditSession(value));

  const preview = (nextColor: PrimaryColor) => {
    const resolved = resolvePrimaryColor(nextColor);

    if (!isCustomPrimaryColor(resolved)) return;

    setSession((current) => ({
      ...current,
      hexDraft: resolved.slice(1),
      pickerColor: resolved,
    }));
    previewPrimaryColor(resolved);
  };

  const commit = (nextColor: PrimaryColor) => {
    const resolved = resolvePrimaryColor(nextColor);

    if (!isCustomPrimaryColor(resolved)) return;

    setSession(createEditSession(resolved));
    dispatch(customPrimaryColorChanged(resolved));
    finishPrimaryColorPreview(resolved);
  };

  const editHex = (nextValue: string) => {
    const sanitized = nextValue.replace(/[^0-9a-fA-F]/g, "").slice(0, 6);
    const nextColor = `#${sanitized.toLowerCase()}`;

    if (isCustomPrimaryColor(nextColor)) {
      setSession(createEditSession(nextColor));
      dispatch(customPrimaryColorChanged(nextColor));
      finishPrimaryColorPreview(nextColor);
      return;
    }

    setSession((current) => ({ ...current, hexDraft: sanitized }));
  };

  const cancelInteraction = () => {
    setSession((current) => createEditSession(current.persistedColor));
    previewPrimaryColor(null);
  };

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);

    if (nextOpen) {
      setSession(createEditSession(value));
      return;
    }

    setSession((current) => createEditSession(current.persistedColor));
    previewPrimaryColor(null);
  };

  return (
    <CustomColorContext.Provider
      value={{
        cancelInteraction,
        color: session.pickerColor,
        commit,
        hexValue: session.hexDraft,
        preview,
        editHex,
      }}
    >
      <Popover onOpenChange={handleOpenChange} open={open} {...props}>
        {children}
      </Popover>
    </CustomColorContext.Provider>
  );
}

function CustomColorPopoverContent({
  align = "end",
  children,
  className,
  ...props
}: React.ComponentProps<typeof PopoverContent>) {
  const { t } = useTranslation();
  const { cancelInteraction, color, commit, preview } = useCustomColor();

  return (
    <PopoverContent align={align} className={cn("w-auto space-y-3 p-3", className)} {...props}>
      <ColorSpectrum
        aria-label={t("settings.accessibility.colorSpectrum")}
        color={color}
        formatHueValue={(hue) => t("settings.accessibility.colorSpectrumHueValue", { hue })}
        formatSpectrumValue={(saturation, value) =>
          t("settings.accessibility.colorSpectrumValue", {
            saturation: Math.round(saturation),
            value: Math.round(value),
          })
        }
        hueLabel={t("settings.accessibility.colorSpectrumHue")}
        onCancel={cancelInteraction}
        onCommit={commit}
        onPreview={preview}
        spectrumRoleDescription={t("settings.accessibility.colorSpectrumRoleDescription")}
        spectrumLabel={t("settings.accessibility.colorSpectrumField")}
      />
      {children}
    </PopoverContent>
  );
}

function CustomColorInput({
  className,
  onChange,
  ...props
}: Omit<React.ComponentProps<typeof Input>, "pattern" | "spellCheck" | "value">) {
  const { editHex, hexValue } = useCustomColor();

  const handleChange: React.ChangeEventHandler<HTMLInputElement> = (event) => {
    editHex(event.currentTarget.value);
    onChange?.(event);
  };

  return (
    <div className="relative">
      <span
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 left-2 -translate-y-1/2 font-mono text-muted-foreground"
      >
        #
      </span>
      <Input
        className={cn("pl-5 font-mono", className)}
        onChange={handleChange}
        pattern="[0-9a-fA-F]{6}"
        spellCheck={false}
        {...props}
        value={hexValue}
      />
    </div>
  );
}

function CustomColorPopoverTrigger(props: React.ComponentProps<typeof PopoverTrigger>) {
  return <PopoverTrigger {...props} />;
}

interface CustomColorContextValue {
  cancelInteraction: () => void;
  color: CustomPrimaryColor;
  commit: (color: PrimaryColor) => void;
  editHex: (value: string) => void;
  hexValue: string;
  preview: (color: PrimaryColor) => void;
}

interface CustomColorEditSession {
  hexDraft: string;
  persistedColor: CustomPrimaryColor;
  pickerColor: CustomPrimaryColor;
}

function createEditSession(color: CustomPrimaryColor): CustomColorEditSession {
  return { hexDraft: color.slice(1), persistedColor: color, pickerColor: color };
}

const CustomColorContext = createContext<CustomColorContextValue | null>(null);

function useCustomColor() {
  const context = useContext(CustomColorContext);

  if (!context) {
    throw new Error("useCustomColor must be used within <CustomColorPopover>.");
  }

  return context;
}

export {
  CustomColorInput,
  CustomColorPopover,
  CustomColorPopoverContent,
  CustomColorPopoverTrigger,
};
