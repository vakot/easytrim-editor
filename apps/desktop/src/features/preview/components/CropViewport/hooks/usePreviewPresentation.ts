import type { RefObject } from "react";
import { useLayoutEffect, useRef, useState } from "react";

import type { CropRect } from "@/domain/crop";
import type { RotationDegrees } from "@/domain/rotation";

import { previewGeometryFor } from "../../../lib/preview-geometry";
import {
  previewFrameAspectFor,
  type PreviewFrameBounds,
  previewFrameBoundsFor,
  type ResolvedPreviewPresentation,
} from "../../../lib/preview-presentation";
import { advanceRotationPresentation } from "../../../lib/rotation-presentation";

interface PreviewPresentationInput {
  crop: CropRect;
  cropIsOpen: boolean;
  flipHorizontal: boolean;
  flipVertical: boolean;
  rotation: RotationDegrees;
}

interface PreviewPresentationTransition {
  from: ResolvedPreviewPresentation;
  fromFrame: PreviewFrameBounds;
  id: number;
  status: "transitioning";
  to: ResolvedPreviewPresentation;
  toFrame: PreviewFrameBounds;
}

interface StablePreviewPresentation {
  state: ResolvedPreviewPresentation;
  status: "stable";
}

type PreviewPresentationState = PreviewPresentationTransition | StablePreviewPresentation;

function targetPresentation(input: PreviewPresentationInput, rotationAngle: number) {
  return { ...input, rotationAngle };
}

function samePresentation(left: ResolvedPreviewPresentation, right: PreviewPresentationInput) {
  return (
    left.rotation === right.rotation &&
    left.crop.x === right.crop.x &&
    left.crop.y === right.crop.y &&
    left.crop.width === right.crop.width &&
    left.crop.height === right.crop.height &&
    left.flipHorizontal === right.flipHorizontal &&
    left.flipVertical === right.flipVertical &&
    left.cropIsOpen === right.cropIsOpen
  );
}

function usePreviewPresentation(
  input: PreviewPresentationInput,
  sourceWidth: number,
  sourceHeight: number,
  immediate: boolean,
  reduceMotion: boolean,
  viewportRef: RefObject<HTMLElement | null>,
  frameRef: RefObject<HTMLElement | null>,
) {
  const [presentation, setPresentation] = useState<PreviewPresentationState>(() => ({
    state: targetPresentation(input, input.rotation),
    status: "stable",
  }));

  const presentationRef = useRef(presentation);
  const transitionId = useRef(0);

  useLayoutEffect(() => {
    const current = presentationRef.current;
    const from = current.status === "transitioning" ? current.to : current.state;
    if (samePresentation(from, input)) {
      if (immediate || reduceMotion) {
        if (current.status === "transitioning") {
          const stable = { state: current.to, status: "stable" } as const;
          presentationRef.current = stable;
          setPresentation(stable);
        }
      }
      return;
    }

    const rotation = advanceRotationPresentation(
      { angle: from.rotationAngle, rotation: from.rotation },
      input.rotation,
      reduceMotion,
    );

    const to = targetPresentation(input, rotation.angle);

    if (immediate || reduceMotion) {
      const stable = { state: to, status: "stable" } as const;
      presentationRef.current = stable;
      setPresentation(stable);
      return;
    }

    const viewportBounds = viewportRef.current?.getBoundingClientRect();
    const frameBounds = frameRef.current?.getBoundingClientRect();
    const geometry = previewGeometryFor(sourceWidth, sourceHeight, to.crop, to.rotation);
    if (
      !viewportBounds ||
      !frameBounds ||
      geometry === null ||
      viewportBounds.width <= 0 ||
      viewportBounds.height <= 0 ||
      frameBounds.width <= 0 ||
      frameBounds.height <= 0
    ) {
      const stable = { state: to, status: "stable" } as const;
      presentationRef.current = stable;
      setPresentation(stable);
      return;
    }

    const aspectRatio = previewFrameAspectFor(geometry, to.cropIsOpen);
    const next = {
      from,
      fromFrame: { width: frameBounds.width, height: frameBounds.height },
      id: ++transitionId.current,
      status: "transitioning",
      to,
      toFrame: previewFrameBoundsFor(
        viewportBounds.width,
        viewportBounds.height,
        aspectRatio,
        to.cropIsOpen,
      ),
    } as const;

    presentationRef.current = next;
    setPresentation(next);
  }, [
    frameRef,
    immediate,
    input,
    input.crop.height,
    input.crop.width,
    input.crop.x,
    input.crop.y,
    input.cropIsOpen,
    input.flipHorizontal,
    input.flipVertical,
    input.rotation,
    reduceMotion,
    sourceHeight,
    sourceWidth,
    viewportRef,
  ]);

  function finishTransition(id: number) {
    const current = presentationRef.current;
    if (current.status !== "transitioning" || current.id !== id) return;
    const stable = { state: current.to, status: "stable" } as const;
    presentationRef.current = stable;
    setPresentation(stable);
  }

  return { finishTransition, presentation };
}

export { usePreviewPresentation };
export type { PreviewPresentationState, PreviewPresentationTransition };
