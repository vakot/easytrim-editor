import { PANEL_GROUP_IDS } from "@/app/panel-layout-runtime";
import { useAppSelector } from "@/app/store/hooks";
import { selectActiveItemId } from "@/app/store/slices/export-slice";
import { selectIsSourceDragActive } from "@/app/store/slices/import-workflow-slice";
import { PANEL_IDS } from "@/app/store/slices/panel-layout-slice";
import { selectSourceSelection } from "@/app/store/slices/source-slice";
import {
  Panel,
  PanelHandle,
  PersistedPanelGroup,
  type PanelRegistration,
} from "@/components/layout/panel";
import { PanelContent } from "@/components/layout/panel-content";
import { ResizablePanel } from "@/components/ui/resizable";
import { EditorStage } from "@/features/editor";
import { useTranslation } from "react-i18next";
import { DropOverlay } from "./components/DropOverlay";
import { SourceSidebar } from "./components/SourceSidebar";

export { CapabilityStatus } from "./components/CapabilityStatus";

const WORKSPACE_PANELS = [
  { id: PANEL_IDS.sourceDetails, panelId: PANEL_IDS.sourceDetails },
  { id: "editor-content-panel" },
] as const satisfies readonly PanelRegistration[];

export function SourceWorkspace() {
  const { t } = useTranslation();
  const isSourceDragActive = useAppSelector(selectIsSourceDragActive);
  const sourceSelection = useAppSelector(selectSourceSelection);
  const activeItemId = useAppSelector(selectActiveItemId);

  return (
    <PersistedPanelGroup
      id={PANEL_GROUP_IDS.workspace}
      panels={WORKSPACE_PANELS}
      orientation="horizontal"
      resizeTargetMinimumSize={{ fine: 8, coarse: 24 }}
      aria-label={t("import.source.workspace")}
    >
      <Panel
        id={PANEL_IDS.sourceDetails}
        resetSize="20rem"
        collapsible
        collapsedSize={0}
        defaultSize="20rem"
        minSize="15rem"
        maxSize="30rem"
        groupResizeBehavior="preserve-pixel-size"
        className="min-h-0 min-w-0 overflow-hidden"
      >
        <div className="h-full pl-1 pb-1">
          <PanelContent>
            <SourceSidebar />
          </PanelContent>
        </div>
      </Panel>

      <PanelHandle
        panelId={PANEL_IDS.sourceDetails}
        id="source-details-resize-handle"
        aria-label={t("import.source.resizeDetails")}
        style={{ width: 4 }}
        className="bg-transparent"
      />

      <ResizablePanel id="editor-content-panel" minSize="44rem" className="pr-1">
        <div className="relative h-full w-full" aria-label={t("import.source.previewArea")}>
          <EditorStage key={activeItemId ?? sourceSelection?.sourcePath ?? "no-source"} />
          {isSourceDragActive ? <DropOverlay /> : null}
        </div>
      </ResizablePanel>
    </PersistedPanelGroup>
  );
}
