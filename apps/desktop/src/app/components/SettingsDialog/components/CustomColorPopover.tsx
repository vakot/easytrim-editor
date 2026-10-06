import { createContext, useContext, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { SpectrumWheel } from "@/components/ui/color";
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
  const { previewPrimaryColor } = useTheme();
  const dispatch = useAppDispatch();

  const [open, setOpen] = useState(false);
  const [color, setColor] = useState<CustomPrimaryColor>(value);
  const [hexValue, setHexValueState] = useState(value.slice(1));

  const committedColorRef = useRef(value);

  const preview = (nextColor: PrimaryColor) => {
    const resolved = resolvePrimaryColor(nextColor);

    if (!isCustomPrimaryColor(resolved)) return;

    setColor(resolved);
    setHexValueState(resolved.slice(1));
    previewPrimaryColor(resolved);
  };

  const commit = (nextColor: PrimaryColor) => {
    const resolved = resolvePrimaryColor(nextColor);

    if (!isCustomPrimaryColor(resolved)) return;

    committedColorRef.current = resolved;

    setColor(resolved);
    setHexValueState(resolved.slice(1));

    previewPrimaryColor(resolved);
    dispatch(customPrimaryColorChanged(resolved));
  };

  const setHexValue = (nextValue: string) => {
    const sanitized = nextValue.replace(/[^0-9a-fA-F]/g, "").slice(0, 6);

    setHexValueState(sanitized);

    const nextColor = `#${sanitized}`;

    if (!isCustomPrimaryColor(nextColor)) return;

    setColor(nextColor);
    committedColorRef.current = nextColor;

    previewPrimaryColor(nextColor);
    dispatch(customPrimaryColorChanged(nextColor));
  };

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);

    if (nextOpen) {
      committedColorRef.current = value;
      setColor(value);
      setHexValueState(value.slice(1));
      return;
    }

    const committedColor = committedColorRef.current;

    setColor(committedColor);
    setHexValueState(committedColor.slice(1));
    previewPrimaryColor(null);
  };

  const close = () => {
    handleOpenChange(false);
  };

  return (
    <CustomColorContext.Provider
      value={{
        close,
        color,
        commit,
        hexValue,
        preview,
        setHexValue,
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
  className,
  ...props
}: React.ComponentProps<typeof PopoverContent>) {
  return (
    <PopoverContent align={align} className={cn("w-auto space-y-3 p-3", className)} {...props} />
  );
}

function CustomColorContent({
  ...props
}: Omit<
  React.ComponentProps<typeof SpectrumWheel>,
  "color" | "onCancel" | "onCommit" | "onPreview"
>) {
  const { t } = useTranslation();
  const { close, color, commit, preview } = useCustomColor();

  return (
    <SpectrumWheel
      aria-label={t("settings.accessibility.colorSpectrum")}
      color={color}
      onCancel={close}
      onCommit={commit}
      onPreview={preview}
      {...props}
    />
  );
}

function CustomColorInput({
  className,
  onChange,
  ...props
}: Omit<React.ComponentProps<typeof Input>, "maxLength" | "pattern" | "spellCheck" | "value">) {
  const { hexValue, setHexValue } = useCustomColor();

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setHexValue(event.target.value);
    onChange?.(event);
  };

  return (
    <Input
      className={cn(
        "h-full border-0 p-0 font-mono text-xs shadow-none focus-visible:ring-0",
        className,
      )}
      maxLength={6}
      onChange={handleChange}
      pattern="[0-9a-fA-F]{6}"
      spellCheck={false}
      value={hexValue}
      {...props}
    />
  );
}

function CustomColorPopoverTrigger(props: React.ComponentProps<typeof PopoverTrigger>) {
  return <PopoverTrigger {...props} />;
}

interface CustomColorContextValue {
  close: () => void;
  color: CustomPrimaryColor;
  commit: (color: PrimaryColor) => void;
  hexValue: string;
  preview: (color: PrimaryColor) => void;
  setHexValue: (value: string) => void;
}

const CustomColorContext = createContext<CustomColorContextValue | null>(null);

function useCustomColor() {
  const context = useContext(CustomColorContext);

  if (!context) {
    throw new Error("Custom color components must be used inside CustomColorPopover");
  }

  return context;
}

export {
  CustomColorContent,
  CustomColorInput,
  CustomColorPopover,
  CustomColorPopoverContent,
  CustomColorPopoverTrigger,
};
