import type { TFunction } from "i18next";
import { Trophy } from "lucide-react";
import { toast } from "sonner";

import { getAchievementDefinition } from "../../../lib/achievements.utils";

/**
 * Announces achievements unlocked together with a single toast, so a burst of unlocks never
 * floods the screen. Toasts never take focus, so they do not interrupt playback or editing.
 */
function showAchievementUnlockToast(achievementIds: readonly string[], t: TFunction): void {
  const definitions = achievementIds.flatMap((id) => getAchievementDefinition(id) ?? []);
  const [first] = definitions;
  if (!first) return;

  if (definitions.length === 1) {
    const Icon = first.icon;
    toast(first.title(t), {
      description: t("achievements.notification.unlocked"),
      icon: <Icon aria-hidden="true" className="size-4 text-primary" />,
      id: `achievement-unlocked:${first.id}`,
    });
    return;
  }

  toast(t("achievements.notification.unlockedMany", { count: definitions.length }), {
    description: definitions.map((definition) => definition.title(t)).join(", "),
    icon: <Trophy aria-hidden="true" className="size-4 text-primary" />,
    id: `achievement-unlocked:${definitions.map((definition) => definition.id).join(",")}`,
  });
}

export { showAchievementUnlockToast };
