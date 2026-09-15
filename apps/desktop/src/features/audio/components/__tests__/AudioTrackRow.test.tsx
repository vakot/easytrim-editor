import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { TooltipProvider } from "@/components/ui/tooltip";

import { mediaWithAudio } from "@/test/source.fixtures";

import { AudioTrackRow } from "../AudioTrackRow";

describe("AudioTrackRow", () => {
  it("keeps focused volume controls available after the pointer leaves", async () => {
    const user = userEvent.setup();
    const onVolumeChange = vi.fn();
    render(
      <TooltipProvider>
        <AudioTrackRow
          onCommit={vi.fn()}
          onPrepareWaveform={vi.fn()}
          onToggle={vi.fn()}
          onVolumeChange={onVolumeChange}
          onWaveformImageError={vi.fn()}
          stream={mediaWithAudio("clip.mp4").audioStreams[0]!}
          title="English"
          track={{ enabled: true, streamIndex: 2, volumePercent: 50, waveform: { status: "idle" } }}
        />
        <button>Outside</button>
      </TooltipProvider>,
    );

    await user.tab();
    await user.tab();
    const slider = screen.getByRole("slider", { name: "English volume" });
    expect(slider).toHaveFocus();
    const card = slider.closest('[data-slot="card"]')!;
    fireEvent.pointerEnter(card);
    fireEvent.pointerLeave(card);
    expect(screen.getByRole("slider", { name: "English volume" })).toHaveFocus();
    await user.keyboard("{ArrowRight}");
    expect(onVolumeChange).toHaveBeenCalled();
    await user.tab();
    expect(screen.queryByRole("slider", { name: "English volume" })).not.toBeInTheDocument();
  });
});
