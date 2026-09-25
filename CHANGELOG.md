# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

### Changed

- Smoothed collapse and expand transitions for the Source List and Activity Feed panels.

## [1.11.0]

### Added

- Added crash recovery that restores the previous editing workspace, active source, and export history after an unexpected shutdown.
- Added separate reset actions to the View and Queue menus, disabled reset actions when their settings are already at default, and kept View and Queue settings untouched by the general preferences reset.
- Added a compact menu for accessing File, View, Queue, Settings, and Help at narrow window widths.
- Added a title-bar Search commands button for opening the Command Palette.
- Added a searchable global command palette for common file and export actions, available with Ctrl+H on Windows/Linux and Cmd+H on macOS.
- Expanded the command palette to include help, appearance, settings, queue, layout, and preview actions with shared menu and shortcut behavior.
- Added an in-app changelog and What's New view for released EasyTrim updates.
- Added Russian as an available interface language.

### Changed

- Smoothed preview rotation, crop, flip, and reset transitions.
- Adapted the empty preview logo for light and dark themes.
- Expanded Media Tools details with FFmpeg and FFprobe versions, executable paths, and concise installation and recheck guidance when tools are unavailable.
- Simplified the empty preview's keyboard hints, added the Open Folder shortcut, and displayed the Command Palette shortcut separately with the correct platform modifier.
- Improved the empty states in the Source Explorer and Activity Feed with clearer guidance.
- Kept configuration choices and update checks in the Command Palette open, while dismissing it after action commands are selected.
- Displayed language options using each language's own name instead of translating them into the current app language.
- Changed the project license to Apache 2.0 with the Commons Clause condition.

### Fixed

- Kept the selected source region visible when rotating a cropped preview.
- Truncated long export filenames in source cards so they stay within the card width.
- Matched destructive and success icon colors in the Command Palette to the shared menu styles.

## [1.10.4]

### Fixed

- Prevented optimized export dialog content and preset controls from being clipped by constrained dialog areas.

## [1.10.3]

### Added

- Added search with match highlighting for imported sources.
- Added grouping of imported sources by folder, import time, or update time.
- Added incremental loading for large source lists.
- Added confirmed close-all and close-group actions for imported sources.
- Added a rebuilt empty source state with clear file and folder import guidance.

## [1.10.2]

### Fixed

- Fixed production Activity Feed toast notifications so their styles are displayed correctly.

## [1.10.1]

### Changed

- Updated the application branding assets and desktop icon sources.

## [1.10.0]

### Added

- Added Activity Feed toast notifications with source and output paths, file sizes, and render times.

### Changed

- Refined the optimized export dialog and preset-management controls.

## [1.9.0]

### Added

- Added imported source cards with thumbnails, metadata, and export history.
- Added a compact export queue window and independent source and export lifecycles, allowing editing to continue while exports run.
- Added restorable export drafts that retain the editor state used for each export.
- Added crop and transform actions for flipping, rotating, and resetting video transformations.

### Changed

- Made export actions more discoverable and improved source responsiveness while working with queued exports.

### Fixed

- Corrected NVENC options and preserved FFmpeg diagnostics when exports fail.
- Stabilized held-frame and shuttle behavior while moving through the timeline.

## [1.8.1]

### Fixed

- Improved preview handling for sources with many audio tracks.

## [1.8.0]

### Added

- Added crop rotation controls for clockwise and counterclockwise rotation.
- Added search within source-tree breadcrumb views.
- Added source creation and update timestamps.

### Changed

- Reserved space for crop controls alongside the preview.

### Fixed

- Kept keyboard focus rings visible inside scrollable editor panels.

## [1.7.1]

### Added

- Added actions to reveal exported files from the Activity Feed and source tree.

## [1.7.0]

### Added

- Added a source explorer with breadcrumbs, an empty state, multi-file drop guidance, and folder import guidance.
- Added actions to reveal imported sources in the system file manager.

### Changed

- Made source side panels resizable and improved source-tree scalability.

## [1.6.0]

### Added

- Added an Explorer view with imported-source counts, an open-editors view, and source-tree context actions.

## [1.5.0]

### Added

- Added tabs for switching between imported sources in the editor preview.

### Changed

- Improved crop preview markers and transitions and made held-frame timeline interactions more responsive.
- Kept optimized export resolution presets and aspect-ratio controls aligned with the active crop.
- Stabilized audio panel sizing for imported sources.

## [1.4.4]

### Fixed

- Corrected preview aspect-ratio handling.
- Prevented the timeline from blinking when the source changes.

## [1.4.3]

### Added

- Added a Help menu action for showing application logs.

### Changed

- Improved panel sizing and disabled-handle pointer behavior.

### Fixed

- Added confirmation before closing the application while exports are running.
- Completed diagnostic work before installing an update.

## [1.4.2]

### Changed

- Improved scroll-area boundaries and panel sizing across the editor.

### Fixed

- Stabilized preview, loading, and source-drop overlays.

## [1.4.1]

### Added

- Added a dedicated Open Folder action for importing folder contents.

### Changed

- Improved branch display in the Activity Feed.

## [1.4.0]

### Added

- Added a local Activity Feed with session-grouped diagnostics, branch/compact/default views, and privacy information.
- Added recursive folder loading with file-operation, fast-cut, and render status entries.
- Added segmented import actions, a source-delete shortcut, and feedback for queue delete and restore actions.

### Changed

- Preserved native window state and ordered exports by their creation time.

## [1.3.0]

### Added

- Added persistent editor panel layout state with collapsible and resizable pane sections.
- Added an application error boundary for a recoverable editor failure state.

### Changed

- Improved imported and export queue composition, accessibility, and delete/restore actions.
- Kept source-independent editor panels mounted while restoring queued editor snapshots.

### Fixed

- Preserved live audio routing during playback transitions.
- Kept the final imported snapshot active when it is promoted to the export queue.

## [1.2.0]

### Added

- Added restorable editor history for queued exports, including trim, crop, and audio settings.
- Added imported-file queue navigation with previous/next, restore, and open-location actions.

### Fixed

- Corrected close and cancel actions to follow the imported-file and export queue lifecycle.

## [1.1.1]

### Added

- Added manual and automatic export-queue starting, with a persisted auto-start preference.

### Fixed

- Made letter-based editor shortcuts work across keyboard layouts.
- Prevented settings default changes from altering the active audio mix.

## [1.1.0]

### Added

- Added deterministic export time, size, frame, FPS, and bitrate estimates to the status bar.
- Added queue controls for starting, skipping, and canceling exports, plus actions to take when the queue finishes.
- Added editor layout controls for showing, hiding, and resetting panels.

### Fixed

- Improved context-menu focus and outside-click handling.
- Cleared terminal export state correctly after an export completes or fails.

## [1.0.9]

### Added

- Added a Settings menu for configuring Snap, Loop, Follow segment, and Merge audio defaults.

### Changed

- Persisted tool defaults and applied them when the application starts and when a source changes.

## [1.0.8]

### Changed

- Clarified when a compatible preview proxy is used and that exports continue to use the original file.
- Preserved timeline pane sizing across source-state changes and improved common preview playback responsiveness.

## [1.0.7]

### Added

- Added a status-bar update action and clearer updater status reporting.

### Fixed

- Prevented Windows updates from relaunching the application unexpectedly.

## [1.0.6]

### Added

- Added a custom title bar with File, View, Help, and panel controls.
- Added Help links for the changelog, project, support, version information, and update checks.
- Added a spectral primary-color picker with persisted custom colors.

### Changed

- Opened the editor directly in an empty workspace instead of a separate welcome page.
- Added a compact empty preview that shows the editor layout and keyboard shortcuts before a source is opened.

## [1.0.5]

### Added

- Added an interactive crop preview with snap markers and keyboard-friendly crop controls.
- Added linked width and height controls for optimized export resolution.
- Added a theme-color picker with presets and a custom color spectrum.

### Changed

- Used the active crop dimensions as the default optimized-export resolution.

### Fixed

- Preserved queued sources when the active source is replaced and reported unexpected export termination as an error.

## [1.0.4]

### Changed

- Preserved editor tool state across source changes and kept source details visible while the export queue scrolls independently.
- Clarified that merging audio requires encoding.

### Fixed

- Retained editor focus after dropping a source from the file manager.
- Preserved playback starts outside the selected segment and stopped transport immediately after preview errors.

## [1.0.3]

### Added

- Added status-bar export progress and metrics, including queued, rendering, completed, and failed states.
- Added the application version to the empty editor view.
- Added a cross-platform action to reveal exported files.

### Changed

- Serialized queued renders so export jobs run in a predictable order.

### Fixed

- Corrected editor timeline panel size constraints.

## [1.0.2]

### Added

- Added platform-native desktop icons for Windows, Linux, and macOS.

### Changed

- Clarified open, save, export, and trim-snap actions with more descriptive labels and tooltips.
- Stabilized preview audio on macOS.

## [1.0.1]

### Added

- Added adjustable preview playback speed.
- Automatically muted silent or near-silent audio tracks during import.

### Changed

- Kept the video timeline fixed while audio tracks scroll and preserved timeline sizing across sources and track configurations.

### Fixed

- Improved native initial-frame loading and video/audio synchronization during loops and timeline interactions.
- Made theme surfaces and release update checks consistent.

## [1.0.0]

### Added

- Added the initial EasyTrim Editor desktop workflow for importing media, inspecting metadata, previewing and trimming video, preparing audio waveforms, and saving fast cuts or optimized renders.
- Added frame navigation, segment playback, safe trim, looping, keyboard shortcuts, and resizable preview, timeline, and audio panes.
- Added per-track audio volume controls, track selection and merging, system-aware themes, language selection, and persisted editor preferences and export presets.

### Changed

- Renamed the product and application branding from ClipKit to EasyTrim Editor.

### Fixed

- Prevented duplicate audio after seeking.
