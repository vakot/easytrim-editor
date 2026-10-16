import "../src/styles/globals.css";

import type { Decorator, Preview } from "@storybook/react";
import { type ReactNode, useLayoutEffect } from "react";

import { PRIMARY_COLOR_PRESETS, primaryColorPalette } from "../src/app/theme/theme";

type Theme = "dark" | "light";
type PrimaryColor = (typeof PRIMARY_COLOR_PRESETS)[number]["id"];

interface DesignTokenCanvasProps {
  children: ReactNode;
  primaryColor: PrimaryColor;
  theme: Theme;
}

function DesignTokenCanvas({ children, primaryColor, theme }: DesignTokenCanvasProps) {
  useLayoutEffect(() => {
    const root = document.documentElement;
    const preset =
      PRIMARY_COLOR_PRESETS.find((color) => color.id === primaryColor) ?? PRIMARY_COLOR_PRESETS[0];
    const palette = primaryColorPalette(preset.color);

    root.classList.toggle("light", theme === "light");
    root.classList.toggle("dark", theme === "dark");
    root.dataset.primaryColor = primaryColor;
    root.dataset.theme = theme;
    root.style.colorScheme = theme;

    root.style.setProperty("--primary-light", palette.light);
    root.style.setProperty("--primary-foreground-light", palette.lightForeground);
    root.style.setProperty("--primary-dark", palette.dark);
    root.style.setProperty("--primary-foreground-dark", palette.darkForeground);
  }, [primaryColor, theme]);

  return children;
}

const withDesignTokens: Decorator = (Story, context) => {
  const theme = (context.globals.theme ?? "light") as Theme;
  const primaryColor = (context.globals.primaryColor ?? "amber") as PrimaryColor;

  return (
    <DesignTokenCanvas primaryColor={primaryColor} theme={theme}>
      <Story />
    </DesignTokenCanvas>
  );
};

const preview: Preview = {
  decorators: [withDesignTokens],
  globalTypes: {
    primaryColor: {
      defaultValue: PRIMARY_COLOR_PRESETS[0].id,
      description: "Primary design-token palette",
      toolbar: {
        items: PRIMARY_COLOR_PRESETS.map((preset) => preset.id),
      },
    },
    theme: {
      defaultValue: "light",
      description: "Color scheme",
      toolbar: {
        items: ["light", "dark"],
      },
    },
  },
  parameters: {
    a11y: {
      test: "todo",
    },
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    layout: "centered",
  },
};

export default preview;
