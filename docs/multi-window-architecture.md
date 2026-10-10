# Multi-window architecture investigation

## Recommendation

Treat the main window as the owner of the editor runtime and introduce secondary windows as
purpose-built clients. A secondary window must not import the full `App` bootstrap or create a
second editor store. Start with a detached, read-only Activity Feed. It is a useful first window
because it projects diagnostic events and needs no editing, preview, source, or export state.

Keep the Activity Feed projection and its present-day embedded view. Add a dedicated
`activity.html` entry and a small Activity Feed root that initializes only styles, i18n, theme
preferences, diagnostics subscription, and the feed view. The main window creates/reopens a native
`activity` webview. Build artifacts should be inspected before making additional feature code lazy;
the second entry already gives Vite a separate dependency graph and permits common chunks.

## Findings in the current app

- `src/main.tsx` always initializes diagnostics, workspace recovery, global error/heartbeat
  listeners, and the source media runtime before rendering.
- `App.tsx` creates one Redux provider and persistor, then starts export queue recovery and providers
  for app updates, editor runtime, shutdown, dialogs, and commands. Rendering it in another webview
  would repeat those side effects.
- The Redux store is a module singleton only within one webview. Each webview has its own JS context;
  sharing Redux Persist's browser storage would not make dispatches or in-memory state shared and
  could cause concurrent writes.
- The Rust `AppState` and `DiagnosticsState` are managed once on the Tauri application and are
  available to commands from all windows. They are the existing native shared-state boundary.
- The Activity Feed currently combines the main webview's in-memory current-session events with
  persisted older sessions. Native `read_persisted_diagnostic_session_events` intentionally returns
  an empty list for the current session, so a detached window cannot yet observe live activity.
- Window-state persistence is already installed with `tauri-plugin-window-state`. It should be
  verified for independent labels before productizing a second resizable window.
- Tauri currently declares one `main` window and one capability scoped to `main`. Vite currently
  has one HTML entry. Both are explicit integration points for a prototype.

## State ownership and synchronization

| State or resource                                             | Owner                                              | Secondary-window access                                                                                             |
| ------------------------------------------------------------- | -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Active source, trim, playback, editor instances, export queue | Main webview Redux store and existing Rust runtime | Read through narrow projections; request supported actions through explicit commands/events                         |
| FFmpeg work, source tokens, temp media, cancellation          | Rust `AppState` / operation owners                 | Existing typed Tauri commands; never create per-window media runtimes                                               |
| Diagnostics session and durable event log                     | One Rust `DiagnosticsState`                        | Subscribe to a typed app-wide event stream; load a snapshot through a read-only command                             |
| Preferences                                                   | Existing persisted preference record               | Read small allowlisted window preferences; route edits through the main owner or a serialized native preference API |
| Window bounds and visibility                                  | Native window manager, keyed by window label       | Persist independently for `main` and `activity`                                                                     |
| Focus, selection, transient controls                          | Owning window                                      | Keep local to that window unless a product interaction requires sharing                                             |

Do not synchronize by letting every webview dispatch arbitrary Redux actions or write the same
persisted root. For later interactive panels, use typed requests with a fixed command/event schema,
validate requests at the receiver, and publish only the state projection the panel needs. If writes
must work while the main webview is absent, first move that domain's authoritative state and
validation into the native app state; do not create two Redux authorities.

## Activity Feed prototype sequence

1. Add a separate HTML/TypeScript entry and a minimal root. Do not import `App`, `store`,
   `PersistGate`, `initializeWorkspaceRecovery`, or `startSourceMediaRuntime` from this entry.
2. Add an allowlisted native command that returns the active diagnostics session identifier and a
   bounded current-session snapshot. Keep persisted-history reads separate from current-session
   reads.
3. After a diagnostic event is validated and durably written, emit a typed `diagnostic-event`
   application event. The feed subscribes before fetching its initial snapshot, de-duplicates by
   session/timestamp/event/operation identity, then applies later events. This avoids polling and
   closes the snapshot/subscription race.
4. Reuse the existing projection and presentation components. Move the activity view mode into an
   explicit prop with a default supplied by the embedded Redux consumer, so the detached view does
   not need a second Redux store.
5. Add a main-window action that requests the native app to create or focus one `activity` window.
   Use fixed title, URL, dimensions, minimum size, and label; do not accept arbitrary URLs or
   capability names from the frontend.
6. Add a capability restricted to `activity` with only core window controls and the diagnostics,
   event, and open-location operations the feed uses. Do not grant media import/export, process,
   updater, arbitrary filesystem, or shell permissions.
7. Verify that window-state storage keys bounds by label and that closing the feed does not trigger
   editor shutdown/recovery behavior. If the plugin does not isolate bounds, store a small validated
   bounds record per fixed label through a native command.

The native event bridge and bounded active-session snapshot are the missing proof points. Until
those exist, a standalone live feed would either be stale or would have to run the full main-window
bootstrap. That makes a separate React-only window an incomplete prototype, so implementation is
deferred to the first prototype slice rather than adding a misleading static window here.

## Startup, lifecycle, and recovery

- Keep diagnostics initialization, panic-hook installation, heartbeat supervision, crash recovery,
  and workspace recovery owned by the single application/main session. Secondary windows attach to
  that session and must never mark it complete on close.
- Move ownership decisions into explicit window roles (for example `main`, `activity`) rather than
  inferring from arbitrary URL parameters. Only the main role installs editor runtime and shutdown
  guards.
- Closing a secondary window destroys that window only. Closing the main window follows the existing
  export-aware shutdown path; decide separately whether active secondary windows are closed with it.
- Keep the source media runtime and temporary artifact ownership in the main/native session. Closing
  or reloading a viewer must not release a source or cancel an export.

## Security, packaging, and tradeoffs

- Bind each capability to an explicit fixed window label. Prefer separate capabilities for the
  editor and each panel over broadening `default` to every webview.
- Use the existing CSP and Tauri asset protocol constraints. The Activity Feed needs no media asset
  scheme access. Keep the event payload limited to the already-sanitized diagnostic event contract.
- A multi-page Vite build can share React and UI chunks while keeping the editor-only entry out of
  the Activity Feed dependency graph. Compare emitted entry/chunk sizes and a production build
  before adding more lazy boundaries; the second HTML entry may duplicate shared CSS or modules if
  build configuration is not tuned.
- The first Activity Feed window is read-only except for opening an already-recorded output location.
  This minimizes synchronization and capability surface. A control panel that edits editor state
  needs request/acknowledgement behavior, stale-state handling, and window-disconnect semantics.
- Native-created windows keep their label, URL, and capability selection under application control.
  They cost more initial native wiring than a frontend-only window, but avoid exposing broad window
  creation or navigation authority to renderer code.

## Follow-up decisions before detachable panels

- Specify the authoritative owner, projection schema, request schema, and failure behavior for each
  state domain before detaching its controls.
- Define whether secondary windows survive main-window reloads and what happens when the owning
  window closes or crashes.
- Measure cold startup, memory per webview, emitted entry/chunk size, and Activity Feed update
  latency with one and multiple windows.
- Verify native window bounds persistence independently on Windows, macOS, and Linux, including
  off-screen bounds after display changes.
- Keep Activity Feed support as a bounded first experiment; do not generalize it into a configurable
  panel framework until a second distinct panel proves the shared contract.
