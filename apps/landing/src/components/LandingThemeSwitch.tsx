import { type LucideIcon, Monitor, Moon, Sun } from "lucide-react";

import { cn } from "@easytrim-editor/ui/class-names";
import type { ThemePreference } from "@easytrim-editor/ui/theme";

import { useLandingTheme } from "../hooks/useLandingTheme";

/** The application's theme options, with the same names and icons as its Appearance settings. */
const themeOptions: readonly { icon: LucideIcon; label: string; value: ThemePreference }[] = [
  { icon: Monitor, label: "System", value: "system" },
  { icon: Sun, label: "Light", value: "light" },
  { icon: Moon, label: "Dark", value: "dark" },
];

function LandingThemeSwitch() {
  const { preference, setPreference } = useLandingTheme();

  return (
    <fieldset className="flex items-center gap-0.5 rounded-full border bg-card/60 p-0.5">
      <legend className="sr-only">Theme</legend>
      {themeOptions.map(({ icon: Icon, label, value }) => (
        <label
          className={cn(
            "grid size-7 cursor-pointer place-items-center rounded-full text-muted-foreground transition-colors hover:text-foreground has-focus-visible:ring-3 has-focus-visible:ring-ring/50",
            preference === value && "bg-secondary text-foreground",
          )}
          key={value}
          title={label}
        >
          <input
            checked={preference === value}
            className="sr-only"
            name="theme"
            onChange={() => setPreference(value)}
            type="radio"
            value={value}
          />
          <Icon aria-hidden="true" className="size-4" />
          <span className="sr-only">{label}</span>
        </label>
      ))}
    </fieldset>
  );
}

export { LandingThemeSwitch };
