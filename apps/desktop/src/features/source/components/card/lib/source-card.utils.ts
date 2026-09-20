import type { TFunction } from "i18next";

import type { SourceStatus } from "@/app/store/slices/source-slice";
import type { EditingInstance } from "@/domain/editing-instance";

import type { SourceCardBadgeVariant, SourceCardStatus, SourceCardVariant } from "../types";

function getSourceCardStatus(
  instance: EditingInstance,
  active: boolean,
  sourceStatus: SourceStatus,
): SourceCardStatus {
  if (instance.sourceAvailability === "deleted") return "deleted";
  if (instance.sourceAvailability === "missing") return "missing";

  if (active && sourceStatus === "failed") return "failed";
  if (active && sourceStatus === "loading-source") return "loading";
  return "ready";
}

function getSourceCardVariant(status: SourceCardStatus, active: boolean): SourceCardVariant {
  if (active) return "active";

  switch (status) {
    case "deleted":
    case "failed":
      return "destructive";
    case "ready":
      return "default";
    case "loading":
    case "missing":
      return "warning";
  }
}

function getSourceCardBadgeVariant(status: SourceCardStatus): SourceCardBadgeVariant {
  switch (status) {
    case "deleted":
    case "failed":
      return "destructive";
    case "ready":
      return "default";
    case "loading":
    case "missing":
      return "warning";
  }
}

function getSourceCardStatusLabel(t: TFunction, status: SourceCardStatus): string {
  switch (status) {
    case "deleted":
      return t("source.status.deleted");
    case "failed":
      return t("source.status.failed");
    case "loading":
      return t("source.status.loading");
    case "missing":
      return t("source.status.missing");
    case "ready":
      return t("source.status.ready");
  }
}

export {
  getSourceCardBadgeVariant,
  getSourceCardStatus,
  getSourceCardStatusLabel,
  getSourceCardVariant,
};
