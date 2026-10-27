import { type LucideIcon, Monitor, Moon, Sun } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { cn } from "@easytrim-editor/ui/class-names";
import type { ThemePreference } from "@easytrim-editor/ui/theme";

import { useLandingTheme } from "../hooks/useLandingTheme";

/** The application's theme options, with the same names and icons as its Appearance settings. */
const themeOptions: readonly { icon: LucideIcon; label: string; value: ThemePreference }[] = [
  { icon: Monitor, label: "System", value: "system" },
  { icon: Sun, label: "Light", value: "light" },
  { icon: Moon, label: "Dark", value: "dark" },
];

/**
 * The System, Light, and Dark choice. On small screens it collapses to the current choice and
 * expands in place when pressed; it collapses again once a theme is chosen or focus leaves it.
 */
function LandingThemeSwitch() {
  const { preference, setPreference } = useLandingTheme();
  const [expanded, setExpanded] = useState(false);
  const toggle = useRef<HTMLButtonElement>(null);
  const group = useRef<HTMLFieldSetElement>(null);
  const returnFocus = useRef(false);
  const current = themeOptions.find((option) => option.value === preference) ?? themeOptions[0]!;
  const CurrentIcon = current.icon;

  useEffect(() => {
    if (expanded) {
      group.current?.querySelector<HTMLInputElement>("input:checked")?.focus();
    } else if (returnFocus.current) {
      returnFocus.current = false;
      // The toggle is hidden on larger screens, where focus simply stays on the chosen option.
      if (toggle.current?.offsetParent) toggle.current.focus();
    }
  }, [expanded]);

  function collapse() {
    returnFocus.current = group.current?.contains(document.activeElement) ?? false;
    setExpanded(false);
  }

  return (
    <>
      <button
        aria-expanded={expanded}
        aria-label={`Theme: ${current.label}`}
        className={cn(
          "grid size-8 place-items-center rounded-full border bg-card/60 text-foreground transition-colors outline-none hover:bg-secondary focus-visible:ring-3 focus-visible:ring-ring/50 sm:hidden",
          expanded && "hidden",
        )}
        onClick={() => setExpanded(true)}
        ref={toggle}
        title={`Theme: ${current.label}`}
        type="button"
      >
        <CurrentIcon aria-hidden="true" className="size-4" />
      </button>
      <fieldset
        className={cn(
          "items-center gap-0.5 rounded-full border bg-card/60 p-0.5 sm:flex",
          expanded ? "flex" : "hidden",
        )}
        onBlur={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget)) setExpanded(false);
        }}
        onKeyDown={(event) => {
          if (event.key === "Escape") collapse();
        }}
        // Pressing an option must not move focus out of the switch first: the blur would collapse
        // it on small screens before the press could choose anything.
        onMouseDown={(event) => event.preventDefault()}
        ref={group}
      >
        <legend className="sr-only">Theme</legend>
        {themeOptions.map(({ icon: Icon, label, value }) => (
          <label
            className={cn(
              "grid size-7 cursor-pointer place-items-center rounded-full text-muted-foreground transition-colors hover:text-foreground has-focus-visible:ring-3 has-focus-visible:ring-ring/50",
              preference === value && "bg-secondary text-foreground",
            )}
            key={value}
            // Choosing with a pointer, even the current option, closes the expanded switch.
            onClick={(event) => {
              if (event.detail > 0) collapse();
            }}
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
    </>
  );
}

export { LandingThemeSwitch };
