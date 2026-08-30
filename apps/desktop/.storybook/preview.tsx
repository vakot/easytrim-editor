import "../src/styles/globals.css";

import type { Decorator, Preview } from "@storybook/react";
import { type ReactNode, useLayoutEffect } from "react";

type Theme = "dark" | "light";
type PrimaryColor = "amber" | "blue" | "emerald" | "rose" | "violet";

interface DesignTokenCanvasProps {
  children: ReactNode;
  primaryColor: PrimaryColor;
  theme: Theme;
}

function DesignTokenCanvas({ children, primaryColor, theme }: DesignTokenCanvasProps) {
  useLayoutEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("light", theme === "light");
    root.classList.toggle("dark", theme === "dark");
    root.dataset.primaryColor = primaryColor;
    root.dataset.theme = theme;
    root.style.colorScheme = theme;
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
      defaultValue: "amber",
      description: "Primary design-token palette",
      toolbar: {
        items: ["amber", "rose", "violet", "blue", "emerald"],
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
