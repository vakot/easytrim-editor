import type { ReactNode } from "react";

import { TooltipProvider } from "@easytrim-editor/ui/tooltip";

import { ResizablePanelContextProvider } from "@/components/ui/resizable";

import { AppUpdatesContext } from "@/app/contexts/app-updates-context";
import { AppDialogsProvider } from "@/app/providers/AppDialogsProvider";
import { ApplicationCommandsProvider } from "@/app/providers/ApplicationCommandsProvider";
import { EditorRuntimeProviders } from "@/app/providers/EditorRuntimeProviders";
import { LayoutDensityProvider } from "@/app/providers/LayoutDensityProvider";
import { UiScaleFeedbackProvider } from "@/app/providers/UiScaleFeedbackProvider";
import { WorkspaceViewsProvider } from "@/app/providers/WorkspaceViewsProvider";
import { ThemeProvider } from "@/app/theme/ThemeProvider";
import { QueueDeleteSourceProvider } from "@/features/export";
import { PreviewTransformProvider } from "@/features/preview";
import { SourceDeleteProvider } from "@/features/source";

const idleAppUpdates = {
  availableVersion: null,
  checkForUpdates: async () => undefined,
  installUpdate: async () => undefined,
  isInstalling: false,
  status: "idle",
} as const;

/**
 * The application provider tree from `App.tsx`, for stories that render command-connected UI.
 * Render it inside a Redux `Provider`; native update checks are replaced by an idle stub.
 */
function AppProvidersFixture({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider>
      <LayoutDensityProvider>
        <WorkspaceViewsProvider>
          <TooltipProvider>
            <SourceDeleteProvider>
              <QueueDeleteSourceProvider>
                <PreviewTransformProvider>
                  <AppUpdatesContext.Provider value={idleAppUpdates}>
                    <EditorRuntimeProviders>
                      <ResizablePanelContextProvider>
                        <AppDialogsProvider>
                          <UiScaleFeedbackProvider>
                            <ApplicationCommandsProvider>{children}</ApplicationCommandsProvider>
                          </UiScaleFeedbackProvider>
                        </AppDialogsProvider>
                      </ResizablePanelContextProvider>
                    </EditorRuntimeProviders>
                  </AppUpdatesContext.Provider>
                </PreviewTransformProvider>
              </QueueDeleteSourceProvider>
            </SourceDeleteProvider>
          </TooltipProvider>
        </WorkspaceViewsProvider>
      </LayoutDensityProvider>
    </ThemeProvider>
  );
}

export { AppProvidersFixture };
