import { Toaster } from "@/components/ui/sonner";

import { ACHIEVEMENT_TOASTER_ID } from "../consts/achievement-toast.consts";

/** A dedicated top-center Sonner host for achievement unlock announcements. */
function AchievementToaster() {
  return (
    <Toaster
      id={ACHIEVEMENT_TOASTER_ID}
      mobileOffset={{ left: "1rem", right: "1rem", top: "2.25rem" }}
      offset={{ top: "2.25rem" }}
      position="top-center"
    />
  );
}

export { AchievementToaster };
