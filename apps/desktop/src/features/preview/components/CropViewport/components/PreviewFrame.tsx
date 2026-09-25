import { motion, type Transition } from "motion/react";
import type { ReactNode, RefObject } from "react";

interface PreviewFrameProps {
  aspectRatio: number;
  children: ReactNode;
  cropEditing: boolean;
  frameRef: RefObject<HTMLDivElement | null>;
  transition: Transition;
}

function PreviewFrame({
  aspectRatio,
  children,
  cropEditing,
  frameRef,
  transition,
}: PreviewFrameProps) {
  const maximumWidth = `${aspectRatio * 100}cqh`;

  return (
    <motion.div
      animate={{ inset: cropEditing ? "28px" : "0px" }}
      className="@container-size absolute"
      data-crop-editing={cropEditing}
      data-preview-area
      initial={false}
      transition={transition}
    >
      <motion.div
        className="absolute inset-0 m-auto overflow-visible"
        data-preview-frame
        layout
        ref={frameRef}
        style={{
          aspectRatio,
          width: `min(100cqw, ${maximumWidth})`,
        }}
        transition={{ layout: transition }}
      >
        {children}
      </motion.div>
    </motion.div>
  );
}

export { PreviewFrame };
