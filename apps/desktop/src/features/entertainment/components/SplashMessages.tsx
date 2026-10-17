import { type RefObject, useEffect, useRef, useState } from "react";

import { useAppDispatch, useAppSelector } from "@/app/store/redux-hooks";
import { selectAchievementsInitialized } from "@/app/store/slices/achievements-slice";
import { discoverSplashMessage } from "@/app/store/thunks/achievement-thunks";
import { cn } from "@/lib/class-names.utils";

import { chooseSplashMessage } from "../lib/splash-messages.utils";
import type { SplashMessageDefinition } from "../types/splash-messages.types";

import styles from "./SplashMessages.module.css";

const splashMessageClasses: Record<string, string> = {
  "chosen-frame": styles.chosenFrame!,
  "corrupted-signal": styles.corruptedSignal!,
  enchantment: styles.enchantment!,
  "frame-not-found": styles.frameNotFound!,
  rainbow: styles.rainbow!,
};

const enchantmentGlyphs = Array.from("ᔑʖᓵ↸ᒷ⎓⊣⍑╎⋮ꖌꖎᒲリ𝙹!¡ᑑ∷ᓭℸ⚍⍊∴ ̇/||");

function SplashMessages({
  className,
  message: fixedMessage,
}: {
  className?: string;
  message?: SplashMessageDefinition;
}) {
  const [randomMessage, setRandomMessage] = useState(() => fixedMessage ?? chooseSplashMessage());
  const splashRef = useRef<HTMLButtonElement>(null);

  const message = fixedMessage ?? randomMessage;

  useEffect(() => {
    if (message.id !== "enchantment-table") return;

    const text = "Enchanting...";
    const textElement = splashRef.current?.querySelector<HTMLElement>("[data-enchantment-text]");
    if (!textElement) return;

    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    let interval: number | undefined;

    const stopScrambling = () => {
      if (interval !== undefined) window.clearInterval(interval);
      interval = undefined;
      textElement.textContent = text;
    };

    const startScrambling = () => {
      if (interval !== undefined) return;
      interval = window.setInterval(() => {
        const characters = Array.from(text);
        const changes = 2 + Math.floor(Math.random() * 3);

        for (let index = 0; index < changes; index += 1) {
          const position = Math.floor(Math.random() * characters.length);
          if (characters[position] !== ".") {
            characters[position] =
              enchantmentGlyphs[Math.floor(Math.random() * enchantmentGlyphs.length)]!;
          }
        }

        textElement.textContent = characters.join("");
      }, 100);
    };

    const updateAnimation = () => {
      if (mediaQuery.matches) stopScrambling();
      else startScrambling();
    };

    updateAnimation();
    mediaQuery.addEventListener("change", updateAnimation);

    return () => {
      mediaQuery.removeEventListener("change", updateAnimation);
      stopScrambling();
    };
  }, [message.id]);

  return (
    <div className={cn("absolute bottom-4 left-full w-md -translate-1/2 -rotate-12", className)}>
      <button
        aria-label={`${message.text} Click for another message`}
        className={cn(
          "w-full animate-splash-bounce font-semibold whitespace-nowrap text-primary text-shadow-2xs motion-reduce:animate-none",
          message.className && splashMessageClasses[message.className],
        )}
        data-keyboard-shortcut-ignore
        onClick={(event) => {
          // Keyboard-activated clicks have detail 0, so they retain focus for keyboard users.
          if (event.detail > 0) event.currentTarget.blur();
          if (!fixedMessage) setRandomMessage(chooseSplashMessage());
        }}
        onKeyDown={(event) => event.stopPropagation()}
        ref={splashRef}
        type="button"
      >
        {message.render ? message.render() : message.text}
      </button>

      {fixedMessage ? null : <SplashMessageDiscovery message={message} target={splashRef} />}
    </div>
  );
}

/**
 * Records a legendary message as discovered once it is actually on screen. Only randomly chosen
 * messages count: a fixed `message`, as used by previews and stories, never renders this. Recording
 * waits until the session's retroactive unlocks are done, so a discovery made right at startup is
 * still announced instead of being unlocked silently with them.
 */
function SplashMessageDiscovery({
  message,
  target,
}: {
  message: SplashMessageDefinition;
  target: RefObject<HTMLElement | null>;
}) {
  const dispatch = useAppDispatch();
  const initialized = useAppSelector(selectAchievementsInitialized);
  const discoverable = message.rarity === "legendary";

  useEffect(() => {
    const element = target.current;
    if (!initialized || !discoverable || !element) return;

    const observer = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return;
      observer.disconnect();
      void dispatch(discoverSplashMessage(message.id));
    });

    observer.observe(element);
    return () => observer.disconnect();
  }, [discoverable, dispatch, initialized, message.id, target]);

  return null;
}

export { SplashMessages };
