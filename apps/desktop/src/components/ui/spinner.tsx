"use client";

import { Loader2Icon } from "lucide-react";
import { useTranslation } from "react-i18next";

import { cn } from "@easytrim-editor/ui/class-names";

function Spinner({ className, ...props }: React.ComponentProps<"svg">) {
  const { t } = useTranslation();

  return (
    <Loader2Icon
      aria-label={t("common.status.loading")}
      className={cn("size-4 motion-safe:animate-spin", className)}
      data-slot="spinner"
      role="status"
      {...props}
    />
  );
}

export { Spinner };
