import "@/i18n/config";

import type { Meta, StoryObj } from "@storybook/react-vite";
import { useMemo } from "react";
import { Provider } from "react-redux";

import { Button } from "@easytrim-editor/ui/button";

import { AppSettingsDialog } from "@/app/dialogs/AppSettingsDialog";
import { useSettingsDialog } from "@/app/hooks/useAppDialog";
import { createAppStore } from "@/app/store/store";
import { AppProvidersFixture } from "@/test/app-providers.fixtures";

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
      <AppProvidersFixture>
        <AppSettingsDialogStoryControls />
        <AppSettingsDialog />
      </AppProvidersFixture>
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
