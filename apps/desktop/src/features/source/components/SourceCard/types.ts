import type { EditingInstance, EditingInstanceListEntry } from "@/domain/editing-instance";

export type SourceCardSource = EditingInstance | EditingInstanceListEntry;
export type SourceCardStatus = "deleted" | "missing" | "ready";
export type SourceCardVariant = "active" | "default" | "destructive" | "warning";
export type SourceCardBadgeVariant = "default" | "destructive" | "warning";
export type SourceCardContent = (props: { source: EditingInstanceListEntry }) => React.ReactNode;
