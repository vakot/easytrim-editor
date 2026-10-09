"use client";

import { Loader2Icon } from "lucide-react";
import { useReducedMotion } from "motion/react";
import { useTranslation } from "react-i18next";

import { cn } from "@/lib/class-names.utils";

function Spinner({ className, ...props }: React.ComponentProps<"svg">) {
  const shouldReduceMotion = useReducedMotion() === true;
  const { t } = useTranslation();

  return (
    <Loader2Icon
      aria-label={t("common.status.loading")}
      className={cn("size-4", shouldReduceMotion !== true && "animate-spin", className)}
      data-slot="spinner"
      role="status"
      {...props}
    />
  );
}

export { Spinner };
