import type { Transition } from "motion/react";

const PREVIEW_TRANSITION_DURATION = 0.3;

function previewTransitionFor(immediate: boolean, reduceMotion: boolean): Transition {
  return {
    duration: immediate || reduceMotion ? 0 : PREVIEW_TRANSITION_DURATION,
    ease: "easeInOut",
    type: "tween",
  };
}

export { PREVIEW_TRANSITION_DURATION, previewTransitionFor };
