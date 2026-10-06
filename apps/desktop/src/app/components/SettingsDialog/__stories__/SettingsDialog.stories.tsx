import "@/i18n/config";

import type { Meta, StoryObj } from "@storybook/react-vite";
import { useMemo } from "react";
import { Provider } from "react-redux";

import { Button } from "@/components/ui/button";
import { ResizablePanelContextProvider } from "@/components/ui/resizable";
import { TooltipProvider } from "@/components/ui/tooltip";

import { SettingsDialog } from "@/app/components/SettingsDialog";
import { AppUpdatesContext } from "@/app/contexts/app-updates-context";
import { useSettingsDialog } from "@/app/hooks/useSettingsDialog";
import { ApplicationCommandsProvider } from "@/app/providers/ApplicationCommandsProvider";
import { EditorRuntimeProviders } from "@/app/providers/EditorRuntimeProviders";
import { LayoutDensityProvider } from "@/app/providers/LayoutDensityProvider";
import { SettingsDialogProvider } from "@/app/providers/SettingsDialogProvider";
import { createAppStore } from "@/app/store/store";
import { ThemeProvider } from "@/app/theme/ThemeProvider";
import { ChangelogProvider } from "@/features/changelog";
import { QueueDeleteSourceProvider } from "@/features/export";
import { PreviewTransformProvider } from "@/features/preview";
import { SourceDeleteProvider } from "@/features/source";

const meta = {
  component: SettingsDialogStory,
  parameters: { layout: "fullscreen" },
  title: "App/Settings Dialog",
} satisfies Meta<typeof SettingsDialogStory>;

export default meta;
type Story = StoryObj<typeof meta>;

function SettingsDialogStory() {
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
              <SettingsDialogProvider>
                <SourceDeleteProvider>
                  <QueueDeleteSourceProvider>
                    <PreviewTransformProvider>
                      <EditorRuntimeProviders>
                        <ResizablePanelContextProvider>
                          <ChangelogProvider>
                            <ApplicationCommandsProvider>
                              <SettingsStoryControls />
                              <SettingsDialog />
                            </ApplicationCommandsProvider>
                          </ChangelogProvider>
                        </ResizablePanelContextProvider>
                      </EditorRuntimeProviders>
                    </PreviewTransformProvider>
                  </QueueDeleteSourceProvider>
                </SourceDeleteProvider>
              </SettingsDialogProvider>
            </LayoutDensityProvider>
          </ThemeProvider>
        </TooltipProvider>
      </AppUpdatesContext.Provider>
    </Provider>
  );
}

function SettingsStoryControls() {
  const { openSettings } = useSettingsDialog();
  return (
    <div className="flex h-screen items-center justify-center bg-background">
      <Button onClick={openSettings}>Open Settings</Button>
    </div>
  );
}

export const Playground: Story = {};
