import type { Meta, StoryObj } from "@storybook/react";
import type { ReactNode } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Toaster } from "@/components/ui/sonner";

type ToastVariant = "default" | "destructive" | "success";

interface ActivityToastScenario {
  action?: {
    label: string;
    onClick: () => void;
  };
  description: ReactNode;
  title: string;
  variant: ToastVariant;
}

const sourcePath = "C:\\Users\\Editor\\Videos\\Client Projects\\Summer Campaign\\source.mp4";
const outputPath =
  "C:\\Users\\Editor\\Videos\\Client Projects\\Summer Campaign\\Exports\\summer-campaign-final.mp4";

function ToastDetails({ children }: { children: ReactNode }) {
  return <div className="grid min-w-0 gap-0.5">{children}</div>;
}

type ScenarioName =
  | "exportCancelled"
  | "exportCompleted"
  | "exportFailed"
  | "fileClosed"
  | "fileDeleted"
  | "fileRestored"
  | "filesOpened";

const scenarios: Record<ScenarioName, ActivityToastScenario> = {
  filesOpened: {
    description: (
      <ToastDetails>
        <span className="truncate" title={sourcePath}>
          {sourcePath}
        </span>
        <span className="truncate" title={outputPath}>
          {outputPath}
        </span>
      </ToastDetails>
    ),
    title: "Opened 2 files",
    variant: "success",
  },
  fileClosed: {
    description: (
      <ToastDetails>
        <span className="truncate" title={sourcePath}>
          {sourcePath}
        </span>
      </ToastDetails>
    ),
    title: "Closed file",
    variant: "success",
  },
  fileDeleted: {
    action: {
      label: "Restore",
      onClick: () => toast.success("File restored", { description: sourcePath }),
    },
    description: (
      <ToastDetails>
        <span className="truncate" title={sourcePath}>
          {sourcePath}
        </span>
      </ToastDetails>
    ),
    title: "File deleted",
    variant: "success",
  },
  fileRestored: {
    description: (
      <ToastDetails>
        <span className="truncate" title={sourcePath}>
          {sourcePath}
        </span>
      </ToastDetails>
    ),
    title: "File restored",
    variant: "success",
  },
  exportCompleted: {
    action: {
      label: "Open",
      onClick: () => toast.success("Output opened", { description: outputPath }),
    },
    description: (
      <ToastDetails>
        <span className="truncate" title={sourcePath}>
          Source: {sourcePath}
        </span>
        <span className="truncate" title={outputPath}>
          Output: {outputPath}
        </span>
        <span>File size: 248 MB · Render time: 00:01:42</span>
      </ToastDetails>
    ),
    title: "Optimized render completed",
    variant: "success",
  },
  exportFailed: {
    description: (
      <ToastDetails>
        <span className="truncate" title={sourcePath}>
          Source: {sourcePath}
        </span>
        <span className="truncate" title={outputPath}>
          Output: {outputPath}
        </span>
        <span>FFmpeg exited with code 1</span>
      </ToastDetails>
    ),
    title: "Optimized render failed",
    variant: "destructive",
  },
  exportCancelled: {
    description: (
      <ToastDetails>
        <span className="truncate" title={sourcePath}>
          Source: {sourcePath}
        </span>
        <span className="truncate" title={outputPath}>
          Output: {outputPath}
        </span>
        <span>Render time: 00:00:18</span>
      </ToastDetails>
    ),
    title: "Optimized render cancelled",
    variant: "default",
  },
};

const meta = {
  component: Toaster,
  parameters: { layout: "fullscreen" },
  title: "Features/Activity Toasts",
} satisfies Meta<typeof Toaster>;

export default meta;

type Story = StoryObj<typeof meta>;

function ActivityToastDemo({ name }: { name: ScenarioName }) {
  const scenario = scenarios[name];

  const showToast = () => {
    const options = {
      description: scenario.description,
      ...(scenario.action ? { action: scenario.action } : {}),
    };

    if (scenario.variant === "destructive") toast.error(scenario.title, options);
    else if (scenario.variant === "success") toast.success(scenario.title, options);
    else toast(scenario.title, options);
  };

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-background p-8">
      <Toaster />
      <Button onClick={showToast}>Show {scenario.title}</Button>
    </div>
  );
}

export const FilesOpened: Story = {
  render: () => <ActivityToastDemo name="filesOpened" />,
};

export const FileClosed: Story = {
  render: () => <ActivityToastDemo name="fileClosed" />,
};

export const FileDeleted: Story = {
  render: () => <ActivityToastDemo name="fileDeleted" />,
};

export const FileRestored: Story = {
  render: () => <ActivityToastDemo name="fileRestored" />,
};

export const ExportCompleted: Story = {
  render: () => <ActivityToastDemo name="exportCompleted" />,
};

export const ExportFailed: Story = {
  render: () => <ActivityToastDemo name="exportFailed" />,
};

export const ExportCancelled: Story = {
  render: () => <ActivityToastDemo name="exportCancelled" />,
};

export const AllScenarios: Story = {
  render: () => (
    <div className="flex min-h-screen w-full flex-wrap items-center justify-center gap-2 bg-background p-8">
      <Toaster />
      {(Object.keys(scenarios) as ScenarioName[]).map((name) => {
        const scenario = scenarios[name];

        return (
          <Button
            key={name}
            onClick={() => {
              const options = {
                description: scenario.description,
                ...(scenario.action ? { action: scenario.action } : {}),
              };

              if (scenario.variant === "destructive") toast.error(scenario.title, options);
              else if (scenario.variant === "success") toast.success(scenario.title, options);
              else toast(scenario.title, options);
            }}
          >
            {scenario.title}
          </Button>
        );
      })}
    </div>
  ),
};
