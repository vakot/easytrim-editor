import type { Transition } from "motion/react";

function previewTransitionFor(isDragging: boolean, reduceMotion: boolean): Transition {
  return {
    duration: isDragging || reduceMotion ? 0 : 0.24,
    ease: "easeInOut",
  };
}

export { previewTransitionFor };
