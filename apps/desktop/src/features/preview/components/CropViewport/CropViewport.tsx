import { CropSelection } from "./components/CropSelection";
import { CropSnapMarkers } from "./components/CropSnapMarkers";
import { CropViewportContextMenu } from "./components/CropViewportContextMenu";
import { CropViewportTooltip } from "./components/CropViewportTooltip";
import { CropViewportVideo } from "./components/CropViewportVideo";

export function CropViewport() {
  return (
    <CropViewportContextMenu>
      {({
        containerRef,
        cropSelection,
        onSourceMetadata,
        onSurfaceBlur,
        onSurfaceClick,
        onSurfacePointerCancel,
        onSurfacePointerMove,
        onSurfacePointerUp,
        previewTransform,
        selectionFrame,
        sourceFrame,
        transformOrigin,
        viewport,
        viewportFrame,
        viewportTransition,
      }) => (
        <CropViewportTooltip
          containerRef={containerRef}
          disabled={cropSelection.isOpen}
          onBlur={onSurfaceBlur}
          onClick={onSurfaceClick}
          onPointerCancel={onSurfacePointerCancel}
          onPointerMove={onSurfacePointerMove}
          onPointerUp={onSurfacePointerUp}
        >
          {!cropSelection.isOpen ? (
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 z-10 rounded-b-xl border border-primary/70 bg-primary/5 opacity-0 ring-1 ring-primary/20 transition-[opacity,transform] duration-150 ease-out group-hover:opacity-100 group-focus-visible:opacity-100 motion-reduce:transition-none"
              data-crop-preview-affordance
            />
          ) : null}
          <div
            className={`absolute overflow-hidden ${viewportTransition}`}
            style={{
              width: viewport.width,
              height: viewport.height,
              left: viewportFrame.left,
              top: viewportFrame.top,
            }}
          >
            <CropViewportVideo
              cropIsOpen={cropSelection.isOpen}
              onSourceMetadata={onSourceMetadata}
              previewTransform={previewTransform}
              sourceFrame={sourceFrame}
              transformOrigin={transformOrigin}
              viewportTransition={viewportTransition}
            />
          </div>
          <CropSnapMarkers frame={viewportFrame} visible={cropSelection.isEditing} />
          {cropSelection.isEditing ? (
            <CropSelection
              enterFrom={cropSelection.enterFrom}
              frame={selectionFrame}
              isDragging={cropSelection.isDragging}
              onPointerDown={cropSelection.startDrag}
              selectionRef={cropSelection.selectionRef}
            />
          ) : null}
        </CropViewportTooltip>
      )}
    </CropViewportContextMenu>
  );
}
