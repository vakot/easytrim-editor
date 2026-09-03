# EasyTrim ownership ledger

This ledger records the source of truth for the values that cross the editor, Redux, and native
runtime boundaries. It is intentionally small: add an entry when a new shared value or lifecycle
resource is introduced.

| Value or resource                                 | Owner                                                                              | Writers                                                             | Readers                                            | Lifetime / reset                                                     | Persistence          |
| ------------------------------------------------- | ---------------------------------------------------------------------------------- | ------------------------------------------------------------------- | -------------------------------------------------- | -------------------------------------------------------------------- | -------------------- |
| Open editing sessions                             | `editingInstances` slice                                                           | import, activation, close, snapshot-sync thunks/listeners           | SourceTree, SourceTabs, export, menus, diagnostics | session; remove only on explicit close                               | never                |
| Current editor snapshot                           | active working slices while editing; `EditingInstance.snapshot` at sync boundaries | trim/crop/audio UI actions; activation and explicit commit boundary | preview, timeline, audio, export, instance history | active instance; hydrate on activation, commit before leaving/export | never                |
| Export request and snapshot                       | `ExportAttempt` entity                                                             | export launch only                                                  | export runtime, export UI, diagnostics             | immutable for the attempt; terminal history until cleared            | never                |
| Export lifecycle status                           | serializable attempt state in Redux                                                | export runtime callbacks, guarded reducers                          | queue menu, SourceTree status, export UI           | `(instanceId, attemptId)`; stale operation IDs are ignored           | never                |
| Native export process, timers, callbacks          | export queue runtime                                                               | enqueue/cancel/cleanup paths                                        | native adapter and runtime only                    | one job per instance; release after terminal cleanup                 | never                |
| Source reservation and deletion deferral          | export queue runtime, keyed by normalized source path                              | enqueue, terminal cleanup, delete request                           | source delete thunk/runtime                        | while dependent jobs exist; flush after queue cycle cleanup          | never                |
| Playback/audio graph and media elements           | feature runtime owners and refs                                                    | preview/audio controllers                                           | feature components and hooks                       | active source; dispose on source change/unmount                      | never                |
| Pointer drag, hover, focus, disclosure, animation | local component or feature-hook state                                              | pointer/keyboard handlers                                           | the owning component                               | interaction lifetime                                                 | never                |
| User preferences                                  | `preferences` slice                                                                | preferences UI                                                      | app shell and feature defaults                     | application lifetime                                                 | persisted allow-list |

## Boundary rules

- High-frequency changes such as pointer movement, animation ticks, video frames, and audio-graph
  updates stay local or in refs. Redux receives the committed value at a meaningful boundary.
- A native handle, callback, timer, `AbortController`, DOM node, `HTMLMediaElement`, or audio node
  must not be placed in Redux or persisted state.
- Async callbacks must carry the IDs that identify their owner. Reducers accept progress and
  terminal results only for the current attempt and operation.
- Source identity uses a normalized comparison key, while the original path remains the value
  used for display and native operations.

The broader state and lifecycle contracts are documented in [state management](state-management.md)
and [editing instance lifecycle](editing-instance-lifecycle.md).
