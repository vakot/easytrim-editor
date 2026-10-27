import type { Meta, StoryObj } from "@storybook/react";
import { type ComponentProps, useEffect, useRef, useState } from "react";

import { Button } from "../button";
import { Confetti } from "../confetti";

type ConfettiProps = ComponentProps<typeof Confetti>;

/** Toggles `active` off and on so each press plays a fresh burst. */
function useReplay() {
  const [active, setActive] = useState(true);
  const frame = useRef(0);
  useEffect(() => () => cancelAnimationFrame(frame.current), []);

  const replay = () => {
    cancelAnimationFrame(frame.current);
    setActive(false);
    frame.current = requestAnimationFrame(() => setActive(true));
  };

  return { active, replay };
}

function Stage({
  active,
  className,
  label,
  ...props
}: Omit<ConfettiProps, "className"> & { className: string; label: string }) {
  const [clicks, setClicks] = useState(0);
  return (
    <div
      className={`relative grid place-items-center rounded-lg border bg-card text-card-foreground ${className}`}
    >
      <Button onClick={() => setClicks((value) => value + 1)} size="sm" variant="outline">
        {label}: clicked {clicks}
      </Button>
      <Confetti active={active} {...props} />
    </div>
  );
}

function Playground(props: ConfettiProps) {
  const { active, replay } = useReplay();
  return (
    <div className="grid gap-4 p-4">
      <div>
        <Button onClick={replay}>Replay</Button>
      </div>
      <div className={props.mode === "border-outside" ? "p-24" : undefined}>
        <Stage {...props} active={active} className="h-72 w-full max-w-2xl" label="Press me" />
      </div>
    </div>
  );
}

function Intensities() {
  const { active, replay } = useReplay();
  return (
    <div className="grid gap-4 p-4">
      <div>
        <Button onClick={replay}>Replay all</Button>
      </div>
      <div className="grid grid-cols-3 gap-4">
        {(["subtle", "normal", "celebration"] as const).map((intensity) => (
          <Stage
            active={active}
            className="h-56"
            intensity={intensity}
            key={intensity}
            label={intensity}
          />
        ))}
      </div>
    </div>
  );
}

function Containers() {
  const { active, replay } = useReplay();
  return (
    <div className="grid gap-4 p-4">
      <div>
        <Button onClick={replay}>Replay both</Button>
      </div>
      <Stage
        active={active}
        className="h-16 w-88"
        intensity="subtle"
        label="Compact (toast size)"
      />
      <Stage
        active={active}
        className="h-96 w-full"
        intensity="celebration"
        label="Large (capped travel)"
      />
    </div>
  );
}

const meta = {
  args: { active: true, duration: 1.6, intensity: "normal", mode: "center" },
  argTypes: {
    mode: {
      control: { type: "inline-radio" },
      options: ["center", "border-outside", "border-inside"],
    },
    duration: { control: { max: 4, min: 0.4, step: 0.2, type: "range" } },
    intensity: { control: { type: "inline-radio" }, options: ["subtle", "normal", "celebration"] },
  },
  component: Confetti,
  parameters: { layout: "fullscreen" },
  render: (args) => <Playground {...args} />,
  tags: ["autodocs"],
  title: "Design System/Confetti",
} satisfies Meta<typeof Confetti>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Particles emit from all sides with counts proportional to edge length, consistent travel ranges throughout emission. Replay restarts emission and the button under the layer stays clickable. No particles appear under prefers-reduced-motion. */
export const Default: Story = {};

/** Particles start at the center and spread outward within the host. */
export const Center: Story = { args: { mode: "center" } };

/** Particles start along all four borders and move outside the host. */
export const BorderOutside: Story = { args: { mode: "border-outside" } };

/** Particles start along all four borders and fall inward, clipped to the host. */
export const BorderInside: Story = { args: { mode: "border-inside" } };

/** Subtle, normal and celebration side by side. */
export const AllIntensities: Story = { render: () => <Intensities /> };

/** The burst is clipped to its host: a toast-sized strip and a large panel. */
export const CompactAndLarge: Story = { render: () => <Containers /> };
