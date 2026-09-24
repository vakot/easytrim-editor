import type { ReactNode, RefObject } from "react";

interface PreviewFrameProps {
  aspectRatio: number;
  children: ReactNode;
  cropEditing: boolean;
  frameRef: RefObject<HTMLDivElement | null>;
}

function PreviewFrame({ aspectRatio, children, cropEditing, frameRef }: PreviewFrameProps) {
  const maximumWidth = `${aspectRatio * 100}cqh`;

  return (
    <div
      className={`absolute ${cropEditing ? "inset-7" : "inset-0"} @container-size`}
      data-preview-area
    >
      <div
        className="absolute inset-0 m-auto overflow-visible transition-[width] duration-200 ease-out motion-reduce:transition-none"
        data-preview-frame
        ref={frameRef}
        style={{
          aspectRatio,
          width: `min(100cqw, ${maximumWidth})`,
        }}
      >
        {children}
      </div>
    </div>
  );
}

export { PreviewFrame };
