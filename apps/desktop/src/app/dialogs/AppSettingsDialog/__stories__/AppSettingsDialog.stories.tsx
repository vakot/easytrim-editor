import "@/i18n/config";

import type { Meta, StoryObj } from "@storybook/react-vite";
import { useMemo } from "react";
import { Provider } from "react-redux";

import { Button } from "@/components/ui/button";
import { ResizablePanelContextProvider } from "@/components/ui/resizable";
import { TooltipProvider } from "@/components/ui/tooltip";

import { AppUpdatesContext } from "@/app/contexts/app-updates-context";
import { AppSettingsDialog } from "@/app/dialogs/AppSettingsDialog";
import { useSettingsDialog } from "@/app/hooks/useAppDialog";
import { AppDialogsProvider } from "@/app/providers/AppDialogsProvider";
import { ApplicationCommandsProvider } from "@/app/providers/ApplicationCommandsProvider";
import { EditorRuntimeProviders } from "@/app/providers/EditorRuntimeProviders";
import { LayoutDensityProvider } from "@/app/providers/LayoutDensityProvider";
import { createAppStore } from "@/app/store/store";
import { ThemeProvider } from "@/app/theme/ThemeProvider";
import { QueueDeleteSourceProvider } from "@/features/export";
import { PreviewTransformProvider } from "@/features/preview";
import { SourceDeleteProvider } from "@/features/source";

const meta = {
  component: AppSettingsDialogStory,
  parameters: { layout: "fullscreen" },
  title: "App/Settings Dialog",
} satisfies Meta<typeof AppSettingsDialogStory>;

export default meta;
type Story = StoryObj<typeof meta>;

function AppSettingsDialogStory() {
  const store = useMemo(() => createAppStore(), []);
  return (
    <Provider store={store}>
      <AppUpdatesContext.Provider
        value={{
          availableVersion: null,
          checkForUpdates: async () => undefined,
          installUpdate: async () => undefined,
          isInstalling: false,
          status: "idle",
        }}
      >
        <TooltipProvider>
          <ThemeProvider>
            <LayoutDensityProvider>
              <AppDialogsProvider>
                <SourceDeleteProvider>
                  <QueueDeleteSourceProvider>
                    <PreviewTransformProvider>
                      <EditorRuntimeProviders>
                        <ResizablePanelContextProvider>
                          <ApplicationCommandsProvider>
                            <AppSettingsDialogStoryControls />
                            <AppSettingsDialog />
                          </ApplicationCommandsProvider>
                        </ResizablePanelContextProvider>
                      </EditorRuntimeProviders>
                    </PreviewTransformProvider>
                  </QueueDeleteSourceProvider>
                </SourceDeleteProvider>
              </AppDialogsProvider>
            </LayoutDensityProvider>
          </ThemeProvider>
        </TooltipProvider>
      </AppUpdatesContext.Provider>
    </Provider>
  );
}

function AppSettingsDialogStoryControls() {
  const { openDialog } = useSettingsDialog();
  return (
    <div className="flex h-screen items-center justify-center bg-background">
      <Button onClick={openDialog}>Open Settings</Button>
    </div>
  );
}

export const Playground: Story = {};
