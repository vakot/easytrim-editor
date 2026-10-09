import { useTranslation } from "react-i18next";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

function ResolutionPresetSelect({
  hasMatchingResolutionPreset,
  onValueChange,
  options,
  resolutionValue,
}: {
  hasMatchingResolutionPreset: boolean;
  onValueChange: (value: string) => void;
  options: readonly { label: string; value: string }[];
  resolutionValue: string;
}) {
  const { t } = useTranslation();

  return (
    <Select
      onValueChange={onValueChange}
      value={hasMatchingResolutionPreset ? resolutionValue : "custom"}
    >
      <SelectTrigger className="w-full" id="export-resolution">
        <SelectValue>
          {!hasMatchingResolutionPreset ? t("export.resolution.customScaling") : undefined}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export { ResolutionPresetSelect };
