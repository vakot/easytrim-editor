import { CheckCircle2, CircleAlert, LoaderCircle } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Badge } from "@/components/ui/badge";

import { useAppSelector } from "@/app/store/redux-hooks";
import { selectActiveInstanceId } from "@/app/store/slices/editing-instances-slice";
import { selectSourceStatus } from "@/app/store/slices/source-slice";

import { useSourceCardData } from "../hooks/useSourceCardData";
import {
  getSourceCardBadgeVariant,
  getSourceCardStatus,
  getSourceCardStatusLabel,
} from "../lib/source-card.utils";
import type { SourceCardBadgeVariant, SourceCardStatus } from "../types";

const statusIcons: Record<SourceCardStatus, typeof CheckCircle2> = {
  deleted: CircleAlert,
  failed: CircleAlert,
  loading: LoaderCircle,
  missing: CircleAlert,
  ready: CheckCircle2,
};

const statusBadgeClassNames: Record<SourceCardBadgeVariant, string> = {
  default: "bg-card/90 text-muted-foreground",
  destructive: "border-destructive/40 bg-destructive/10 text-destructive",
  warning: "border-warning/40 bg-warning/10 text-warning",
};

function SourceCardStatusBadge({ className }: { className?: string }) {
  const source = useSourceCardData();
  const { t } = useTranslation();
  const activeInstanceId = useAppSelector(selectActiveInstanceId);
  const sourceStatus = useAppSelector(selectSourceStatus);

  const active = source.id === activeInstanceId;
  const status = getSourceCardStatus(source, active, sourceStatus);
  const statusLabel = getSourceCardStatusLabel(t, status);
  const variant = getSourceCardBadgeVariant(status);
  const StatusIcon = statusIcons[status];

  if (status === "ready") return;

  return (
    <Badge
      className={`gap-1 backdrop-blur-sm ${statusBadgeClassNames[variant]} ${className ?? ""}`}
      size="xs"
      variant="outline"
    >
      <StatusIcon
        aria-hidden="true"
        className={status === "loading" ? "animate-spin" : undefined}
      />
      {statusLabel}
    </Badge>
  );
}

export { SourceCardStatusBadge };
