import type { Meta, StoryObj } from "@storybook/react";
import { toast } from "sonner";

import { Button } from "../button";
import { Toaster } from "../sonner";

type ToastType = "default" | "error" | "info" | "loading" | "success" | "warning";

const toastTitles: Record<ToastType, string> = {
  default: "Export queued",
  error: "Export failed",
  info: "Export started",
  loading: "Rendering export",
  success: "Export finished",
  warning: "Source file is missing",
};

const meta = {
  component: Toaster,
  parameters: { layout: "fullscreen" },
  title: "Design System/Sonner",
} satisfies Meta<typeof Toaster>;

export default meta;

type Story = StoryObj<typeof meta>;

function ToastDemo({ type }: { type: ToastType }) {
  const showToast = () => {
    const title = toastTitles[type];
    const description = "C:\\Users\\Editor\\Videos\\Exports\\summer-campaign.mp4";

    switch (type) {
      case "error":
        toast.error(title, { description });
        break;
      case "info":
        toast.info(title, { description });
        break;
      case "loading":
        toast.loading(title, { description });
        break;
      case "success":
        toast.success(title, { description });
        break;
      case "warning":
        toast.warning(title, { description });
        break;
      default:
        toast(title, { description });
    }
  };

  return (
    <div className="flex min-h-48 min-w-80 items-center justify-center bg-background p-8">
      <Toaster />
      <Button onClick={showToast}>Show {type} toast</Button>
    </div>
  );
}

export const Default: Story = {
  render: () => <ToastDemo type="default" />,
};

export const Success: Story = {
  render: () => <ToastDemo type="success" />,
};

export const Info: Story = {
  render: () => <ToastDemo type="info" />,
};

export const Warning: Story = {
  render: () => <ToastDemo type="warning" />,
};

export const Error: Story = {
  render: () => <ToastDemo type="error" />,
};

export const Loading: Story = {
  render: () => <ToastDemo type="loading" />,
};

export const AllTypes: Story = {
  render: () => (
    <div className="flex min-h-48 min-w-80 flex-wrap items-center justify-center gap-2 bg-background p-8">
      <Toaster />
      {(Object.keys(toastTitles) as ToastType[]).map((type) => (
        <Button
          key={type}
          onClick={() => {
            const description = "C:\\Users\\Editor\\Videos\\Exports\\summer-campaign.mp4";
            if (type === "default") toast(toastTitles[type], { description });
            else toast[type](toastTitles[type], { description });
          }}
        >
          {type}
        </Button>
      ))}
    </div>
  ),
};
