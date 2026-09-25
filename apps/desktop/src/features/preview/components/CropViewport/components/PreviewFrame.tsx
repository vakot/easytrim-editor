import { motion, type Transition } from "motion/react";
import type { CSSProperties, ReactNode } from "react";

interface PreviewFrameProps {
  aspectRatio: number;
  children: ReactNode;
  cropEditing: boolean;
  transition: Transition;
}

function PreviewFrame({ aspectRatio, children, cropEditing, transition }: PreviewFrameProps) {
  const normalWidth = `min(100cqw, ${aspectRatio * 100}cqh)`;
  const cropEditingWidth = `min(max(0px, calc(100cqw - 56px)), max(0px, calc(${aspectRatio * 100}cqh - ${aspectRatio * 56}px)))`;
  const previewAreaStyle = {
    "--preview-normal-width": normalWidth,
    "--preview-crop-width": cropEditingWidth,
    "--preview-aspect-ratio": aspectRatio,
  } as CSSProperties;

  return (
    <div className="@container-size absolute inset-0" data-preview-area style={previewAreaStyle}>
      <motion.div
        className="absolute inset-0 m-auto aspect-(--preview-aspect-ratio) overflow-visible data-[crop-editing=false]:w-(--preview-normal-width) data-[crop-editing=true]:w-(--preview-crop-width)"
        data-aspect-ratio={aspectRatio}
        data-crop-editing={cropEditing}
        data-preview-frame
        initial={false}
        layout
        transition={{ layout: transition }}
      >
        {children}
      </motion.div>
    </div>
  );
}

export { PreviewFrame };
