import { Fragment } from "react";
import { useTranslation } from "react-i18next";

import {
  ContextMenuCheckboxItem,
  ContextMenuGroup,
  ContextMenuLabel,
  ContextMenuSeparator,
} from "@/components/ui/context-menu";
import {
  MenubarCheckboxItem,
  MenubarGroup,
  MenubarLabel,
  MenubarSeparator,
} from "@/components/ui/menubar";

import type { ApplicationCommandId } from "@/app/commands";
import {
  ApplicationCommandHint,
  ApplicationCommandLabel,
  ApplicationCommandMenuItem,
} from "@/app/components/ApplicationCommandMenuItem";
import type { SidebarId, SidebarViewId } from "@/app/layout/lib/sidebar-layout";
import { getDockViewGroups } from "@/app/layout/lib/workspace-view-registry";
import { useAppSelector } from "@/app/store/redux-hooks";
import { selectSidebarLayout } from "@/app/store/slices/preferences-slice";

function getDockViewCommandId(viewId: SidebarViewId, contextSide?: SidebarId) {
  return contextSide
    ? (`dock-workspace-view-${viewId}-${contextSide}` as ApplicationCommandId)
    : (`dock-workspace-view-${viewId}` as ApplicationCommandId);
}

function DockViewMenuItems({ contextSide }: { contextSide?: SidebarId }) {
  const { t } = useTranslation();
  const layout = useAppSelector(selectSidebarLayout);
  const groups = getDockViewGroups(layout);

  return (
    <>
      {groups.map((group, index) => {
        const label =
          group.id === "available"
            ? t("layout.available")
            : group.id === "left"
              ? t("layout.leftSidebar")
              : t("layout.rightSidebar");

        return (
          <Fragment key={group.id}>
            {index > 0 ? contextSide ? <ContextMenuSeparator /> : <MenubarSeparator /> : null}
            {contextSide ? (
              <ContextMenuGroup>
                <ContextMenuLabel>{label}</ContextMenuLabel>
                {group.views.map((viewId) => (
                  <ContextDockViewItem
                    commandId={getDockViewCommandId(viewId, contextSide)}
                    key={viewId}
                  />
                ))}
              </ContextMenuGroup>
            ) : (
              <MenubarGroup>
                <MenubarLabel>{label}</MenubarLabel>
                {group.views.map((viewId) => (
                  <MenubarDockViewItem commandId={getDockViewCommandId(viewId)} key={viewId} />
                ))}
              </MenubarGroup>
            )}
          </Fragment>
        );
      })}
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
