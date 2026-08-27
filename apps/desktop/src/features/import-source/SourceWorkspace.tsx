import { EDITOR_PANEL_GROUP_IDS } from "@/app/editor-layout-runtime";
import {
  EditorPanel,
  EditorPanelContent,
  EditorPanelHandle,
  PersistedEditorPanelGroup,
  type EditorPanelRegistration,
} from "@/app/components/EditorPanel";
import { useAppSelector } from "@/app/store/hooks";
import { EDITOR_PANEL_IDS } from "@/app/store/slices/editor-layout-slice";
import { selectActiveItemId } from "@/app/store/slices/export-slice";
import { selectIsSourceDragActive } from "@/app/store/slices/import-workflow-slice";
import { selectSourceSelection } from "@/app/store/slices/source-slice";
import { PanelContent } from "@/components/layout/panel-content";
import { ResizablePanel } from "@/components/ui/resizable";
import { EditorStage } from "@/features/editor";
import { useTranslation } from "react-i18next";
import { DropOverlay } from "./components/DropOverlay";
import { SourceSidebar } from "./components/SourceSidebar";

export { CapabilityStatus } from "./components/CapabilityStatus";

const WORKSPACE_PANELS = [
  { id: "source-details-panel", panelId: EDITOR_PANEL_IDS.sourceDetails },
  { id: "editor-content-panel" },
] as const satisfies readonly EditorPanelRegistration[];

export function SourceWorkspace() {
  const { t } = useTranslation();
  const isSourceDragActive = useAppSelector(selectIsSourceDragActive);
  const sourceSelection = useAppSelector(selectSourceSelection);
  const activeItemId = useAppSelector(selectActiveItemId);

  return (
    <PersistedEditorPanelGroup
      id={EDITOR_PANEL_GROUP_IDS.workspace}
      panels={WORKSPACE_PANELS}
      orientation="horizontal"
      resizeTargetMinimumSize={{ fine: 8, coarse: 24 }}
      aria-label={t("import.source.workspace")}
    >
      <EditorPanel panelId={EDITOR_PANEL_IDS.sourceDetails} resetSize="20rem">
        <EditorPanelContent
          id="source-details-panel"
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
        </EditorPanelContent>

        <EditorPanelHandle
          id="source-details-resize-handle"
          aria-label={t("import.source.resizeDetails")}
          className="mb-1 mx-0.5 bg-transparent"
        />
      </EditorPanel>

      <ResizablePanel id="editor-content-panel" minSize="44rem" className="pr-1">
        <div className="relative h-full w-full" aria-label={t("import.source.previewArea")}>
          <EditorStage key={activeItemId ?? sourceSelection?.sourcePath ?? "no-source"} />
          {isSourceDragActive ? <DropOverlay /> : null}
        </div>
      </ResizablePanel>
    </PersistedEditorPanelGroup>
  );
}
