import { useTranslation } from "react-i18next";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface ResolutionPresetSelectProps {
  hasMatchingResolutionPreset: boolean;
  onValueChange: (value: string) => void;
  options: readonly { label: string; value: string }[];
  resolutionValue: string;
}

function ResolutionPresetSelect({
  hasMatchingResolutionPreset,
  onValueChange,
  options,
  resolutionValue,
}: ResolutionPresetSelectProps) {
  const { t } = useTranslation();

  return (
    <Select
      onValueChange={onValueChange}
      value={hasMatchingResolutionPreset ? resolutionValue : "custom"}
    >
      <SelectTrigger className="w-full min-w-0" id="export-resolution">
        <SelectValue>
          {!hasMatchingResolutionPreset ? t("export.labels.customScaling") : undefined}
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
