import { useRef, type KeyboardEvent, type PointerEvent } from "react";

interface EmptyStageResizeHandleProps {
  label: string;
  previewSize: number;
  onPreviewSizeChange: (size: number) => void;
  onDoubleClick: () => void;
}

export function EmptyStageResizeHandle({
  label,
  previewSize,
  onPreviewSizeChange,
  onDoubleClick,
}: EmptyStageResizeHandleProps) {
  const startRef = useRef<{ y: number; size: number; height: number } | null>(null);

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    const height = event.currentTarget.parentElement?.getBoundingClientRect().height ?? 0;
    startRef.current = { y: event.clientY, size: previewSize, height };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const start = startRef.current;
    if (!start || start.height <= 0) return;

    const size = start.size + ((event.clientY - start.y) / start.height) * 100;
    onPreviewSizeChange(Math.min(90, Math.max(10, size)));
  };

  const handlePointerEnd = (event: PointerEvent<HTMLDivElement>) => {
    startRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const step = event.shiftKey ? 10 : 2;
    if (event.key === "ArrowUp" || event.key === "ArrowLeft") {
      event.preventDefault();
      onPreviewSizeChange(Math.max(10, previewSize - step));
    } else if (event.key === "ArrowDown" || event.key === "ArrowRight") {
      event.preventDefault();
      onPreviewSizeChange(Math.min(90, previewSize + step));
    } else if (event.key === "Home") {
      event.preventDefault();
      onPreviewSizeChange(10);
    } else if (event.key === "End") {
      event.preventDefault();
      onPreviewSizeChange(90);
    }
  };

  return (
    <div
      role="separator"
      tabIndex={0}
      aria-label={label}
      aria-orientation="horizontal"
      aria-valuemin={10}
      aria-valuemax={90}
      aria-valuenow={Math.round(previewSize)}
      className="group relative z-20 h-2 shrink-0 cursor-row-resize bg-transparent outline-none focus-visible:bg-primary/20"
      onDoubleClick={onDoubleClick}
      onKeyDown={handleKeyDown}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerEnd}
      onPointerCancel={handlePointerEnd}
      onLostPointerCapture={handlePointerEnd}
    >
      <span className="pointer-events-none absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-border/55 transition-colors group-hover:bg-primary/70 group-focus-visible:bg-primary" />
    </div>
  );
}
