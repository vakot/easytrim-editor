import { Check } from "lucide-react";
import { useTranslation } from "react-i18next";

import { useTheme } from "@/app/theme/use-theme";
import { PRIMARY_COLORS, type PrimaryColor } from "@/app/theme/theme";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

const colorClasses: Record<PrimaryColor, string> = {
  amber: "bg-[#efbf04]",
  rose: "bg-[#e85d75]",
  violet: "bg-[#8b6ee8]",
  blue: "bg-[#4299e1]",
  emerald: "bg-[#32a876]",
};

export function PrimaryColorSelector() {
  const { t } = useTranslation();
  const { primaryColor, setPrimaryColor } = useTheme();

  return (
    <Popover>
      <PopoverTrigger
        className="flex size-10 items-center justify-center rounded-md outline-none transition-opacity hover:opacity-80 focus-visible:ring-2 focus-visible:ring-ring"
        aria-label={t("themeColor.selection", { color: t(`themeColor.${primaryColor}`) })}
      >
        <span
          className="size-5 rounded-full ring-1 ring-foreground/15"
          aria-hidden="true"
          style={{
            background:
              "conic-gradient(from 210deg, #e85d75, #efbf04, #32a876, #4299e1, #8b6ee8, #e85d75)",
          }}
        />
      </PopoverTrigger>
      <PopoverContent className="w-auto p-2" align="end">
        <div className="flex gap-1" role="group" aria-label={t("themeColor.label")}>
          {PRIMARY_COLORS.map((color) => {
            const selected = color === primaryColor;
            return (
              <button
                key={color}
                className={`flex size-9 items-center justify-center rounded-full outline-none transition-transform hover:scale-110 focus-visible:ring-2 focus-visible:ring-ring ${colorClasses[color]} ${selected ? "ring-2 ring-foreground ring-offset-2 ring-offset-popover" : ""}`}
                type="button"
                aria-label={t("themeColor.option", { color: t(`themeColor.${color}`) })}
                aria-pressed={selected}
                onClick={() => setPrimaryColor(color)}
              >
                {selected ? (
                  <Check className="size-4 text-white drop-shadow-sm" aria-hidden="true" />
                ) : null}
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
