import { useEffect, useRef, useState } from "react";

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
    </div>
  );
}

export { SplashMessages };
