import { motion, type Transition } from "motion/react";
import type { CSSProperties, ReactNode, RefObject } from "react";

import type { PreviewPresentationState } from "../hooks/usePreviewPresentation";

interface PreviewFrameProps {
  aspectRatio: number;
  children: ReactNode;
  cropEditing: boolean;
  frameRef: RefObject<HTMLDivElement | null>;
  onTransitionComplete: (id: number) => void;
  presentation: PreviewPresentationState;
  transition: Transition;
}

function PreviewFrame({
  aspectRatio,
  children,
  cropEditing,
  frameRef,
  onTransitionComplete,
  presentation,
  transition,
}: PreviewFrameProps) {
  const normalWidth = `min(100cqw, ${aspectRatio * 100}cqh)`;
  const cropEditingWidth = `min(max(0px, calc(100cqw - 56px)), max(0px, calc(${aspectRatio * 100}cqh - ${aspectRatio * 56}px)))`;
  const previewAreaStyle = {
    "--preview-normal-width": normalWidth,
    "--preview-crop-width": cropEditingWidth,
    "--preview-aspect-ratio": aspectRatio,
  } as CSSProperties;

  const isTransitioning = presentation.status === "transitioning";

  return (
    <div className="@container-size absolute inset-0" data-preview-area style={previewAreaStyle}>
      <motion.div
        animate={
          isTransitioning
            ? { width: presentation.toFrame.width, height: presentation.toFrame.height }
            : undefined
        }
        className="absolute inset-0 m-auto aspect-(--preview-aspect-ratio) overflow-visible data-[crop-editing=false]:w-(--preview-normal-width) data-[crop-editing=true]:w-(--preview-crop-width)"
        data-aspect-ratio={aspectRatio}
        data-crop-editing={cropEditing}
        data-presentation-status={presentation.status}
        data-preview-frame
        initial={false}
        ref={frameRef}
        style={
          isTransitioning
            ? { width: presentation.fromFrame.width, height: presentation.fromFrame.height }
            : undefined
        }
        transition={transition}
      >
        {children}
        {isTransitioning ? (
          <motion.div
            animate={{ opacity: 1 }}
            aria-hidden="true"
            className="pointer-events-none absolute size-0"
            data-transition-clock
            initial={{ opacity: 0 }}
            key={presentation.id}
            onAnimationComplete={() => onTransitionComplete(presentation.id)}
            transition={transition}
          />
        ) : null}
      </motion.div>
    </div>
  );
}

export { PreviewFrame };
