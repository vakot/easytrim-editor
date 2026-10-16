# Achievements

EasyTrim keeps an optional, local-only collection of achievements: milestones reached through
exports and discoveries made while using the editor. They are shown in the Achievements dialog and
counted in the Statistics dialog. There is no XP, level, account, leaderboard, or remote storage,
and achievements never change what the editor can do.

## Ownership

| Concern                    | Owner                                                                       |
| -------------------------- | --------------------------------------------------------------------------- |
| Definitions                | `features/entertainment/consts/achievements.consts.ts` (the registry)       |
| Evaluation and progress    | `features/entertainment/lib/achievements.utils.ts` (pure functions)         |
| Export-related progress    | Usage statistics; achievements keep no counters of their own                |
| Unlocks and discoveries    | native `AchievementStore`, persisted in the application data directory      |
| Frontend state             | `achievements` slice: a runtime mirror of the native records                |
| Unlocking and announcement | `AchievementTracker`, mounted once by the application                       |
| Presentation               | Achievements dialog, the Statistics dialog metric, and unlock notifications |

The frontend owns the catalog: identifiers, localized copy, icons, categories, metrics, targets,
and secrecy. Rust stores only identifiers and unlock times, validating each identifier as bounded
lowercase kebab-case and bounding every stored collection. Neither side keeps a competing copy of
the other's data: the slice only merges native snapshots, and statistics stay in
`usage-statistics.json`.

## Definitions

Each registry entry declares an `id`, `title` and `description` (functions that call `t` with literal
keys), a Lucide `icon`, a `category`, a `metric`, a `target`, and an optional `secret` flag. An
achievement unlocks once its metric reaches its target. Adding one needs only a registry entry and
its English copy; the dialog, statistics metric, and notifications pick it up. Never rename or
reuse an existing `id`: it is the persisted key of the unlock.

| Metric                    | Source                                                           | Unit     |
| ------------------------- | ---------------------------------------------------------------- | -------- |
| `completedExports`        | all export routes in usage statistics                            | count    |
| `losslessExports`         | Fast Exports (Lossless Cuts)                                     | count    |
| `gifExports`              | GIF exports                                                      | count    |
| `audioExports`            | audio-only exports                                               | count    |
| `processingMillis`        | FFmpeg processing time                                           | duration |
| `sourceBytes`             | Source Data Processed                                            | bytes    |
| `storageSavedBytes`       | Storage Saved, never below zero                                  | bytes    |
| `legendarySplashMessages` | distinct discovered IDs that are legendary in the splash catalog | count    |

Byte targets use binary units (1 GB = 1024³ bytes), matching how the dialogs format sizes. The
Chosen One's target is the number of legendary splash messages, so it follows the splash catalog
instead of duplicating its list.

## Unlocking

`AchievementTracker` loads the records and statistics when the application starts and evaluates
whenever either changes; nothing polls. Statistics refresh after every completed export, and the
records change after every unlock or discovery. Evaluations run one at a time against the latest
store state and send only achievements that are earned but not yet unlocked to
`unlock_achievements`.

The native store unlocks each achievement once, at the time it is first recognized, and reports
which identifiers the call newly unlocked. Repeated, concurrent, or stale requests therefore never
change an unlock time or report an unlock twice.

**Retroactive unlocks.** The first successful evaluation of a session unlocks everything the stored
progress already earned, such as the 1, 10, and 100 export milestones for a user with 150 exports.
These unlocks get the time they were recognized, never an invented historical time, and are not
announced. If that first evaluation fails, it stays retroactive until one succeeds.

**Notifications.** Later unlocks are announced through the existing toast infrastructure: one toast
with the achievement's icon and title for a single unlock, or one summary toast for several unlocked
together. Toasts never take focus, so they do not interrupt playback, exports, or editing, and the
toaster disables its motion when reduced motion is preferred. A secret's title appears only in the
toast of its own unlock.

## Legendary splash discoveries

A splash message counts as discovered when it is on screen: `SplashMessages` observes the rendered
message with an `IntersectionObserver` and records it once it intersects the viewport. Only
messages the component chose at random count; a fixed `message`, as used by previews and stories,
never records anything. Only legendary messages are recorded, and a message already in the records
skips the native call, so repeated appearances cause no writes.

Recording waits until the session's retroactive unlocks are done, so a discovery made right at
startup is still announced. Storybook has no native backend, so achievements never initialize
there and stories cannot record discoveries or unlock anything.

## Secret achievements

Until unlocked, a secret achievement shows `???`, a lock icon, and a generic description, with no
unlock condition or progress. After unlocking it shows like any other achievement.

## Persistence

The document is `<app data>/achievements/achievements.json`:

```json
{
  "version": 1,
  "unlockedAchievements": {
    "first-export": { "unlockedAtMillis": 1760000000000 }
  },
  "discoveredSplashMessageIds": ["rainbow-mode"]
}
```

It follows the same conventions as [usage statistics](usage-statistics.md) and shares their loader:

- **Crash safety:** each change is written to a synced temporary file that atomically replaces
  the document.
- **Serialized updates:** one mutex covers each update and its write, so concurrent unlocks and
  discoveries cannot overwrite each other.
- **No redundant writes:** an unlock or discovery that changes nothing is not written.
- **Migration:** `decode_achievement_records` dispatches on `version`; fields missing from a known
  version default to empty.
- **Recovery:** an invalid document, including one with malformed identifiers or oversized
  collections, or one written by a newer version, is renamed aside to
  `achievements.<timestamp>.<reason>.json` and the collection restarts empty. If the file cannot be
  read or moved aside, it is left untouched and the session keeps records in memory only. Load and
  write problems are recorded as `achievements.*` diagnostic events without paths.

Achievements survive restarts and workspace resets, and are independent of sources, editing
instances, and the Export Queue. Nothing is sent anywhere.
