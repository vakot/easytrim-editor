import type { Transition } from "motion/react";

function previewTransformTransitionFor(isDragging: boolean, reduceMotion: boolean): Transition {
  return {
    duration: isDragging || reduceMotion ? 0 : 0.24,
    ease: "easeInOut",
    type: "tween",
  };
}

function cropSelectionFadeTransitionFor(reduceMotion: boolean): Transition {
  return {
    duration: reduceMotion ? 0 : 0.2,
    ease: "easeOut",
    type: "tween",
  };
}

export { cropSelectionFadeTransitionFor, previewTransformTransitionFor };
