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

The collection mixes two kinds of entries, each shown as one card:

- **Milestone series** have a `title`, `description`, Lucide `icon`, `category`, `metric`, and
  Bronze, Silver, and Gold `thresholds`. Each tier is an independently unlockable achievement with
  its own identifier, `<series id>-<tier>` such as `export-mastery-silver`, and its own unlock time.
- **Standalone achievements** have a single `target` and an optional `secret` flag. The secret
  The Chosen One is the only one today.

Titles and descriptions are functions that call `t` with literal keys. An achievement unlocks once
its metric reaches its threshold or target. Adding a series or achievement needs only a registry
entry and its English copy; the dialog, statistics metric, and notifications pick it up. Never
rename or reuse an existing identifier: it is the persisted key of the unlock.

| Series             | Metric              | Bronze | Silver | Gold   |
| ------------------ | ------------------- | ------ | ------ | ------ |
| Export Mastery     | `completedExports`  | 1      | 10     | 100    |
| Lossless Precision | `losslessExports`   | 1      | 10     | 50     |
| GIF Creator        | `gifExports`        | 1      | 5      | 25     |
| Audio Specialist   | `audioExports`      | 1      | 5      | 25     |
| Time Well Spent    | `processingMillis`  | 1 min  | 10 min | 1 h    |
| Data Cruncher      | `sourceBytes`       | 1 GB   | 10 GB  | 100 GB |
| Storage Saver      | `storageSavedBytes` | 100 MB | 1 GB   | 10 GB  |

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

Byte thresholds use binary units (1 GB = 1024³ bytes), matching how the dialogs format sizes. The
Chosen One's target is the number of legendary splash messages, so it follows the splash catalog
instead of duplicating its list. Thresholds are meant to be reached through normal use; the
collection has no XP, levels, or grind-only milestones.

The collection counts every tier and standalone achievement: seven series and The Chosen One make 22
achievements, which is the total in the dialog header and the Statistics dialog.

## Collection cards

A series card reflects its highest unlocked tier: its border, a subtle background tint, and the
primary icon take that tier's color, and a badge names the tier. A locked series stays neutral with
a `Locked` badge. The card shows progress toward the next tier and, after Gold, a completed state
instead.

Below it, one chip per tier shows a `Medal` icon and the tier's threshold, such as `100 MB`, `1 GB`,
and `10 GB`. Every chip keeps its own tier color, so lower tiers stay bronze or silver once a higher
tier is reached. An unlocked chip shows its full color with a matching solid border; a locked chip
dims its medal on a neutral dashed border. Progression does not rely on color alone: chips are
always ordered Bronze, Silver, Gold, locked and unlocked chips differ in border style, the badge and
"Next" label name tiers in text, and each chip's accessible label states its tier, threshold, and
unlock date.

Bronze, Silver, and Gold use the theme tokens `--achievement-bronze`, `--achievement-silver`, and
`--achievement-gold`, defined for light and dark themes. The Unlocked filter shows cards with at
least one unlocked tier, and the Locked filter shows cards with at least one locked tier, so a
partly unlocked series appears under both.

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
progress already earned, such as all three Export Mastery tiers for a user with 150 exports.
These unlocks get the time they were recognized, never an invented historical time, and are not
announced. If that first evaluation fails, it stays retroactive until one succeeds.

**Notifications.** Later unlocks are announced through the existing toast infrastructure, one
announcement per evaluation. A newly unlocked tier names its series and tier, such as "GIF Creator:
Silver tier unlocked", with the series icon in the tier's color. Several tiers of one series
unlocked together, as when one large export passes two size thresholds, collapse to the highest
tier. Unlocks across several series or standalone achievements become one summary toast. Toasts
never take focus, so they do not interrupt playback, exports, or editing, and the toaster disables
its motion when reduced motion is preferred. A secret's title appears only in the announcement of
its own unlock.

`createAchievementAnnouncement` builds the announcement (achievement IDs, title, description, icon,
and tier) separately from `showAchievementAnnouncement`, which renders it as a toast. A custom
presentation with its own visuals, particles, or sound can replace the renderer without changing
how unlocks are batched.

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
  "version": 2,
  "unlockedAchievements": {
    "export-mastery-bronze": { "unlockedAtMillis": 1760000000000 }
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
  version default to empty. Version 1 stored standalone milestones. When version 2 grouped them into
  series, each one equivalent to a tier kept its unlock time under the tier's identifier:

  | Version 1            | Version 2                   |
  | -------------------- | --------------------------- |
  | `first-export`       | `export-mastery-bronze`     |
  | `getting-started`    | `export-mastery-silver`     |
  | `export-veteran`     | `export-mastery-gold`       |
  | `first-lossless-cut` | `lossless-precision-bronze` |
  | `gif-maker`          | `gif-creator-bronze`        |
  | `one-hour-later`     | `time-well-spent-gold`      |
  | `data-cruncher`      | `data-cruncher-gold`        |
  | `storage-saver`      | `storage-saver-gold`        |

  `export-legend`, `lossless-legend`, `audio-specialist`, and `working-overtime` have no equivalent
  tier and are dropped. Their progress lives in usage statistics, so every tier they imply unlocks
  again silently on the next evaluation, with the time it is recognized. The migrated document is
  written as version 2 on the next change.

- **Recovery:** an invalid document, including one with malformed identifiers or oversized
  collections, or one written by a newer version, is renamed aside to
  `achievements.<timestamp>.<reason>.json` and the collection restarts empty. If the file cannot be
  read or moved aside, it is left untouched and the session keeps records in memory only. Load and
  write problems are recorded as `achievements.*` diagnostic events without paths.

Achievements survive restarts and workspace resets, and are independent of sources, editing
instances, and the Export Queue. Nothing is sent anywhere.
