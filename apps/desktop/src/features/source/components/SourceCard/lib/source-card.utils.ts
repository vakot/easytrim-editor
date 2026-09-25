import type { TFunction } from "i18next";

import type { EditingInstanceListEntry } from "@/domain/editing-instance";

import type { SourceCardBadgeVariant, SourceCardStatus, SourceCardVariant } from "../types";

function getSourceCardStatus(instance: EditingInstanceListEntry): SourceCardStatus {
  if (instance.sourceAvailability === "deleted") return "deleted";
  if (instance.sourceAvailability === "missing") return "missing";
  return "ready";
}

function getSourceCardVariant(status: SourceCardStatus, active: boolean): SourceCardVariant {
  if (active) return "active";

  switch (status) {
    case "deleted":
      return "destructive";
    case "ready":
      return "default";
    case "missing":
      return "warning";
  }
}

function getSourceCardBadgeVariant(status: SourceCardStatus): SourceCardBadgeVariant {
  switch (status) {
    case "deleted":
      return "destructive";
    case "ready":
      return "default";
    case "missing":
      return "warning";
  }
}

function getSourceCardStatusLabel(t: TFunction, status: SourceCardStatus): string {
  switch (status) {
    case "deleted":
      return t("source.status.deleted");
    case "missing":
      return t("source.status.missing");
    case "ready":
      return "";
  }
}

export {
  getSourceCardBadgeVariant,
  getSourceCardStatus,
  getSourceCardStatusLabel,
  getSourceCardVariant,
};
