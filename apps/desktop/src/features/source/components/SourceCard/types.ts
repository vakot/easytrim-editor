import type { EditingInstance } from "@/domain/editing-instance";

export type SourceCardStatus = "deleted" | "failed" | "loading" | "missing" | "ready";
export type SourceCardVariant = "active" | "default" | "destructive" | "warning";
export type SourceCardBadgeVariant = "default" | "destructive" | "warning";
export type SourceCardContent = (props: { source: EditingInstance }) => React.ReactNode;
