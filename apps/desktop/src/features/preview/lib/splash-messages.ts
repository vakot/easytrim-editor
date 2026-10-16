import { Crown } from "lucide-react";
import type { ReactNode } from "react";
import { createElement } from "react";

type SplashRarity = "common" | "uncommon" | "rare" | "legendary";

type SplashMessageDefinition<T extends SplashRarity = SplashRarity> = {
  className?: string;
  id: string;
  rarity: T;
  render?: () => ReactNode;
  text: string;
};

const splashRarityWeights: Record<SplashRarity, number> = {
  common: 12,
  uncommon: 4,
  rare: 1,
  legendary: 0.25,
};

const splashMessagesCommon = [
  { id: "ffmpeg", text: "Powered by FFmpeg!", rarity: "common" },
  { id: "lossless", text: "Lossless means lossless!", rarity: "common" },
  { id: "trim-first", text: "Trim first, regret never!", rarity: "common" },
  { id: "second-chances", text: "Undo believes in second chances!", rarity: "common" },
  { id: "cutting-corners", text: "Cutting videos, not corners!", rarity: "common" },
  { id: "more-trimming", text: "Now with 100% more trimming!", rarity: "common" },
  { id: "just-one-cut", text: "Just one more cut...", rarity: "common" },
  { id: "stay-sharp", text: "Stay sharp!", rarity: "common" },
  { id: "snip-snip", text: "Snip snip!", rarity: "common" },
  { id: "keep-it-short", text: "Keep it short!", rarity: "common" },
  { id: "perfect-cut", text: "Every frame counts!", rarity: "common" },
  { id: "no-time-to-waste", text: "No time to waste!", rarity: "common" },
  { id: "cut-to-the-chase", text: "Cut to the chase!", rarity: "common" },
  { id: "less-is-more", text: "Less is more!", rarity: "common" },
  { id: "made-to-trim", text: "Born to trim!", rarity: "common" },
  { id: "timeline-awaits", text: "Your timeline awaits!", rarity: "common" },
  { id: "happy-trimming", text: "Happy trimming!", rarity: "common" },
  { id: "frames-forever", text: "Frames are forever!", rarity: "common" },
  { id: "trimming-edge", text: "Trimming-edge technology!", rarity: "common" },
  { id: "tiny-but-mighty", text: "Tiny but mighty!", rarity: "common" },
  { id: "clip-it", text: "Clip it like it's hot!", rarity: "common" },
  { id: "no-filler", text: "No filler, just frames!", rarity: "common" },
  { id: "press-space", text: "Press Space to... wait.", rarity: "common" },
  { id: "in-and-out", text: "I in, O out!", rarity: "common" },
  { id: "ready-when-you-are", text: "Ready when you are!", rarity: "common" },
  { id: "time-is-relative", text: "Time is relative!", rarity: "common" },
  { id: "keep-rolling", text: "Keep rolling!", rarity: "common" },
  { id: "pixel-perfect", text: "Pixel perfect-ish!", rarity: "common" },
  { id: "one-frame-at-a-time", text: "One frame at a time!", rarity: "common" },
  { id: "made-with-care", text: "Made with care and caffeine!", rarity: "common" },
] satisfies SplashMessageDefinition<"common">[];

const splashMessagesUncommon = [
  { id: "frame-perfect", text: "Frame perfect. Probably.", rarity: "uncommon" },
  { id: "works-on-my-machine", text: "Works on my machine™", rarity: "uncommon" },
  { id: "no-render-farm", text: "No render farm required!", rarity: "uncommon" },
  { id: "codec-gods", text: "Praise the codec gods!", rarity: "uncommon" },
  { id: "one-more-export", text: "One more export and I'm done.", rarity: "uncommon" },
  { id: "trust-the-process", text: "Trust the process. Literally.", rarity: "uncommon" },
  { id: "zero-dropped-frames", text: "Zero dropped frames. Allegedly.", rarity: "uncommon" },
  { id: "buttery-smooth", text: "Smooth as 60 FPS!", rarity: "uncommon" },
  { id: "not-a-bug", text: "It's a feature, actually.", rarity: "uncommon" },
  { id: "timeline-therapy", text: "Timeline therapy session!", rarity: "uncommon" },
  { id: "ctrl-z", text: "Ctrl+Z saved my life!", rarity: "uncommon" },
  { id: "rendering-feelings", text: "Rendering your feelings...", rarity: "uncommon" },
  { id: "ffmpeg-magic", text: "FFmpeg goes brrrr!", rarity: "uncommon" },
  { id: "still-compiling", text: "Still compiling my thoughts.", rarity: "uncommon" },
  { id: "it-depends", text: "It depends on the codec.", rarity: "uncommon" },
  { id: "ship-it", text: "Ship it! Wait, test it first.", rarity: "uncommon" },
] satisfies SplashMessageDefinition<"uncommon">[];

const splashMessagesRare = [
  { id: "no-electron", text: "No Electron detected!", rarity: "rare" },
  { id: "empty-state", text: "You found the empty state!", rarity: "rare" },
  { id: "not-premiere", text: "Definitely not Premiere Pro!", rarity: "rare" },
  { id: "tauri-power", text: "Rust inside. Crab approved.", rarity: "rare" },
  { id: "hello-world", text: "Hello, World!", rarity: "rare" },
  { id: "undefined-behavior", text: "Undefined behavior not included!", rarity: "rare" },
  { id: "secret-sauce", text: "The secret ingredient is FFmpeg.", rarity: "rare" },
  { id: "forty-two", text: "The answer is 42 frames.", rarity: "rare" },
  { id: "one-does-not", text: "One does not simply cut on a keyframe.", rarity: "rare" },
  { id: "side-project", text: "Just a small side project...", rarity: "rare" },
] satisfies SplashMessageDefinition<"rare">[];

const splashMessagesLegendary = [
  {
    className: "enchantment",
    id: "enchantment-table",
    rarity: "legendary",
    render: () => createElement("span", { "data-enchantment-text": true }, "Enchanting..."),
    text: "Enchanting...",
  },
  {
    className: "rainbow",
    id: "rainbow-mode",
    rarity: "legendary",
    text: "Now in technicolor!",
  },
  {
    className: "corrupted-signal",
    id: "corrupted-signal",
    rarity: "legendary",
    text: "SIGNAL LOST_",
  },
  {
    className: "chosen-frame",
    id: "chosen-frame",
    rarity: "legendary",
    render: () =>
      createElement(
        "span",
        { className: "inline-flex items-center gap-2 font-bold" },
        createElement(Crown, { className: "size-[1em]", "aria-hidden": true }),
        "THE CHOSEN FRAME",
      ),
    text: "THE CHOSEN FRAME",
  },
  {
    className: "frame-not-found",
    id: "frame-not-found",
    rarity: "legendary",
    render: () =>
      createElement(
        "span",
        {
          "aria-hidden": true,
          className: "glitch-text",
          "data-text": "404: FRAME NOT FOUND",
        },
        "404: FRAME NOT FOUND",
      ),
    text: "404: FRAME NOT FOUND",
  },
] satisfies SplashMessageDefinition<"legendary">[];

const splashMessagesByRarity: Record<SplashRarity, SplashMessageDefinition[]> = {
  common: splashMessagesCommon,
  uncommon: splashMessagesUncommon,
  rare: splashMessagesRare,
  legendary: splashMessagesLegendary,
};

const splashMessages = Object.values(splashMessagesByRarity).flat();

const splashMessageHistory: string[] = [];
const splashMessageHistoryLimit = 3;

function chooseSplashMessage(): SplashMessageDefinition {
  const rarities = (Object.keys(splashRarityWeights) as SplashRarity[]).filter((rarity) =>
    splashMessagesByRarity[rarity].some((message) => !splashMessageHistory.includes(message.id)),
  );

  let selection =
    Math.random() * rarities.reduce((total, rarity) => total + splashRarityWeights[rarity], 0);

  const rarity =
    rarities.find((rarity) => (selection -= splashRarityWeights[rarity]) < 0) ?? rarities[0]!;

  const messages = splashMessagesByRarity[rarity].filter(
    (message) => !splashMessageHistory.includes(message.id),
  );

  const message = messages[Math.floor(Math.random() * messages.length)]!;

  splashMessageHistory.push(message.id);

  if (splashMessageHistory.length > splashMessageHistoryLimit) {
    splashMessageHistory.shift();
  }

  return message;
}

export { chooseSplashMessage, splashMessages };
export type { SplashMessageDefinition };
