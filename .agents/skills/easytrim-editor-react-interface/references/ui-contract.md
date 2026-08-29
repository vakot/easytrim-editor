# UI contract

Read this reference before creating or materially changing the editor interface.

Frontend feature/component ownership and dependency direction live in the [structure rule](../../../rules/structure.md). TypeScript and frontend test commands live in the [verification rule](../../../rules/verification.md).

## 1. State shape

Suggested session state:

```text
presetsById
selectedPresetId
source: null | {
  sourceId
  metadata
  preview
  trim
  audioSelections
  optimizedSettings
  outputNameBase
}
operation
lastError
```

Derived values include selected duration, valid export state, available scale choices, displayed frame rate, and route-specific final filename.

Source replacement transaction:

1. cancel/ignore source-bound async work;
2. install the new source ID and loading state;
3. reset trim to the full duration after inspection;
4. enable all discovered audio tracks;
5. reset scale/frame-rate to source;
6. prefill the new basename;
7. retain runtime presets and current preset selection.

If replacement inspection fails, keep the failed new import/error state and offer immediate picker/drop retry. Never restore the previous source. Tag every asynchronous completion with source ID; tag waveform generations with source ID and waveform job ID.

## 2. Timeline math

Keep these as pure functions:

```text
timeToRatio(time, duration)
ratioToTime(ratio, duration)
clientXToTime(clientX, trackRect, duration)
clampStart(candidate, end, minimumGap)
clampEnd(candidate, start, duration, minimumGap)
formatTime(time)
```

Use the canonical integer unit shared with native DTOs. Make the minimum gap explicit and testable rather than deriving it from visual pixel width.

## 3. Playback behavior

- Permit full-source playback and seeking.
- Seek preview to a boundary when its trim handle moves.
- Keep dragging responsive when media seeking lags.
- Use `requestAnimationFrame` for visual playhead movement; commit lower-frequency canonical time updates to React state.
- Do not silently redefine the selected range during playback.
- Map Space to play/pause and Left/Right Arrow to previous/next frame when focus is not in an
  editable or independently keyboard-controlled element.
- `I` sets trim start at the playhead and resets trim end to source end when crossed; `O` sets trim
  end and resets trim start to zero when crossed. Disable source-edge actions that would create an
  empty segment.

## 4. Audio rows

Each row shows:

- mute/unmute icon with an interactive level popover;
- stream title/language fallback;
- codec and channel layout;
- aligned waveform;
- selected trim overlay shared with the video timeline.

“Merge audio” means one output audio stream, not necessarily mono. Label mono separately if added later.

Waveform failure leaves the row enabled and exportable. Show a compact unavailable state and retry action without blocking the editor.

Use the always-visible master slider for output and preview gain without rewriting per-track levels.
Per-track sliders range from mute through +6 dB, reset to 0 dB on double-click, and muted tracks
are excluded from export and merge inputs.

## 5. Export settings

Fast cut:

- no resolution or frame-rate controls;
- source characteristics shown as preserved;
- compact keyframe note;
- merge toggle changes the route label to hybrid audio encoding.

Optimized render:

- source/2160p/1440p/1080p options only when useful;
- separate source/common frame-rate options preserving fractional values;
- editable custom-argument string;
- runtime preset name and save/update/delete controls;
- assembled command preview on the same screen.

Both routes:

- required editable output basename;
- compatible extension shown;
- direct primary button;
- save dialog after route click;
- in-place progress and cancellation.

## 6. Visual and interaction baseline

- Use a dark neutral editor surface optimized for video.
- Use one accent color for trim selection and primary actions.
- Keep touch-oriented targets at least 44 by 44 CSS pixels where practical.
- Communicate selected/disabled state without relying on color alone.
- Keep the compact top toolbar limited to direct actions such as `Open video`; add no dropdown
  navigation or context menus for editor actions.
- Reserve motion for direct manipulation and progress.
- Keep export buttons visible at the minimum supported window size.
