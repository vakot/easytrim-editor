import { ContextMenuCheckboxItem } from "@/components/ui/context-menu";
import { MenubarCheckboxItem } from "@/components/ui/menubar";

import type { ApplicationCommandId } from "@/app/commands";
import {
  ApplicationCommandHint,
  ApplicationCommandLabel,
  ApplicationCommandMenuItem,
} from "@/app/components/ApplicationCommandMenuItem";
import type { SidebarId, SidebarViewId } from "@/app/layout/lib/sidebar-layout";
import { WORKSPACE_VIEWS } from "@/app/layout/lib/workspace-view-registry";

function getDockViewCommandId(viewId: SidebarViewId, contextSide?: SidebarId) {
  return contextSide
    ? (`dock-workspace-view-${viewId}-${contextSide}` as ApplicationCommandId)
    : (`dock-workspace-view-${viewId}` as ApplicationCommandId);
}

function DockViewMenuItems({ contextSide }: { contextSide?: SidebarId }) {
  return (
    <>
      {WORKSPACE_VIEWS.map(({ id: viewId }) =>
        contextSide ? (
          <ContextDockViewItem commandId={getDockViewCommandId(viewId, contextSide)} key={viewId} />
        ) : (
          <MenubarDockViewItem commandId={getDockViewCommandId(viewId)} key={viewId} />
        ),
      )}
    </>
  );
}

function ContextDockViewItem({ commandId }: { commandId: ApplicationCommandId }) {
  return (
    <ApplicationCommandMenuItem asChild commandId={commandId}>
      <ContextMenuCheckboxItem keepOpen>
        <ApplicationCommandLabel />
        <ApplicationCommandHint />
      </ContextMenuCheckboxItem>
    </ApplicationCommandMenuItem>
  );
}

function MenubarDockViewItem({ commandId }: { commandId: ApplicationCommandId }) {
  return (
    <ApplicationCommandMenuItem asChild commandId={commandId}>
      <MenubarCheckboxItem keepOpen>
        <ApplicationCommandLabel />
        <ApplicationCommandHint />
      </MenubarCheckboxItem>
    </ApplicationCommandMenuItem>
  );
}

export { DockViewMenuItems };
