import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { CropRect } from "@/domain/crop";
import type { RotationDegrees } from "@/domain/rotation";

import { usePreviewPresentation } from "../usePreviewPresentation";

const FULL_CROP: CropRect = { x: 0, y: 0, width: 1, height: 1 };

function makeElement(width: number, height: number): HTMLDivElement {
  return {
    getBoundingClientRect: vi.fn(() => new DOMRect(0, 0, width, height)),
  } as unknown as HTMLDivElement;
}

function input(rotation: RotationDegrees, crop: CropRect = FULL_CROP, cropIsOpen = false) {
  return {
    crop,
    cropIsOpen,
    flipHorizontal: false,
    flipVertical: false,
    rotation,
  };
}

describe("usePreviewPresentation", () => {
  it("mounts directly into the source presentation without an initial transition", () => {
    const viewportRef = { current: makeElement(800, 600) };
    const frameRef = { current: makeElement(800, 450) };
    const { result } = renderHook(() =>
      usePreviewPresentation(input(270), 1920, 1080, false, false, viewportRef, frameRef),
    );

    expect(result.current.presentation).toMatchObject({
      status: "stable",
      state: { rotation: 270, rotationAngle: 270 },
    });
  });

  it.each([
    [0, 90, 90],
    [90, 180, 180],
    [180, 270, 270],
    [270, 0, 360],
    [0, 270, -90],
  ] as Array<[RotationDegrees, RotationDegrees, number]>)(
    "resolves %i to %i as one from/to presentation transition",
    (fromRotation, toRotation, targetAngle) => {
      const viewportRef = { current: makeElement(800, 600) };
      const frameRef = { current: makeElement(800, 450) };
      const { rerender, result } = renderHook(
        ({ rotation }) =>
          usePreviewPresentation(input(rotation), 1920, 1080, false, false, viewportRef, frameRef),
        { initialProps: { rotation: fromRotation } },
      );

      rerender({ rotation: toRotation });

      expect(result.current.presentation).toMatchObject({
        status: "transitioning",
        from: { rotation: fromRotation, rotationAngle: fromRotation },
        to: { rotation: toRotation, rotationAngle: targetAngle },
      });
    },
  );

  it("resolves crop changes immediately during direct manipulation", () => {
    const viewportRef = { current: makeElement(800, 600) };
    const frameRef = { current: makeElement(800, 450) };
    const nextCrop = { x: 0.5, y: 0, width: 0.5, height: 1 };
    const { rerender, result } = renderHook(
      ({ crop, immediate }) =>
        usePreviewPresentation(input(0, crop), 1920, 1080, immediate, false, viewportRef, frameRef),
      { initialProps: { crop: FULL_CROP, immediate: false } },
    );

    rerender({ crop: nextCrop, immediate: true });

    expect(result.current.presentation).toMatchObject({
      status: "stable",
      state: { crop: nextCrop },
    });
  });

  it("resolves crop open from the current stable frame before transitioning", () => {
    const viewportRef = { current: makeElement(800, 600) };
    const frameRef = { current: makeElement(800, 450) };
    const { rerender, result } = renderHook(
      ({ cropIsOpen }) =>
        usePreviewPresentation(
          { ...input(0), cropIsOpen },
          1920,
          1080,
          false,
          false,
          viewportRef,
          frameRef,
        ),
      { initialProps: { cropIsOpen: false } },
    );

    rerender({ cropIsOpen: true });

    expect(result.current.presentation).toMatchObject({
      status: "transitioning",
      from: { cropIsOpen: false },
      fromFrame: { width: 800, height: 450 },
      to: { cropIsOpen: true },
      toFrame: { width: 744, height: 418.5 },
    });
  });

  it("resolves crop close from the crop-safe frame to the normal contain frame", () => {
    const viewportRef = { current: makeElement(800, 600) };
    const frameRef = { current: makeElement(744, 418.5) };
    const { rerender, result } = renderHook(
      ({ cropIsOpen }) =>
        usePreviewPresentation(
          { ...input(0), cropIsOpen },
          1920,
          1080,
          false,
          false,
          viewportRef,
          frameRef,
        ),
      { initialProps: { cropIsOpen: true } },
    );

    rerender({ cropIsOpen: false });

    expect(result.current.presentation).toMatchObject({
      status: "transitioning",
      from: { cropIsOpen: true },
      fromFrame: { width: 744, height: 418.5 },
      to: { cropIsOpen: false },
      toFrame: { width: 800, height: 450 },
    });
  });

  it("finishes an active presentation before direct manipulation takes ownership", () => {
    const viewportRef = { current: makeElement(800, 600) };
    const frameRef = { current: makeElement(800, 450) };
    const { rerender, result } = renderHook(
      ({ cropIsOpen, immediate }) =>
        usePreviewPresentation(
          { ...input(0), cropIsOpen },
          1920,
          1080,
          immediate,
          false,
          viewportRef,
          frameRef,
        ),
      { initialProps: { cropIsOpen: false, immediate: false } },
    );

    rerender({ cropIsOpen: true, immediate: false });
    expect(result.current.presentation.status).toBe("transitioning");

    rerender({ cropIsOpen: true, immediate: true });

    expect(result.current.presentation).toMatchObject({
      status: "stable",
      state: { cropIsOpen: true },
    });
  });

  it("resolves reduced motion directly to the destination", () => {
    const viewportRef = { current: makeElement(800, 600) };
    const frameRef = { current: makeElement(800, 450) };
    const { rerender, result } = renderHook(
      ({ reduceMotion }) =>
        usePreviewPresentation(input(0), 1920, 1080, false, reduceMotion, viewportRef, frameRef),
      { initialProps: { reduceMotion: false } },
    );

    rerender({ reduceMotion: true });

    expect(result.current.presentation).toMatchObject({
      status: "stable",
      state: { rotation: 0, rotationAngle: 0 },
    });
  });

  it("releases transition geometry to the resolved stable state", () => {
    const viewportRef = { current: makeElement(800, 600) };
    const frameRef = { current: makeElement(800, 450) };
    const { rerender, result } = renderHook(
      ({ rotation }) =>
        usePreviewPresentation(input(rotation), 1920, 1080, false, false, viewportRef, frameRef),
      { initialProps: { rotation: 0 as RotationDegrees } },
    );

    rerender({ rotation: 90 });
    const transition = result.current.presentation;
    expect(transition.status).toBe("transitioning");
    if (transition.status !== "transitioning") return;

    act(() => result.current.finishTransition(transition.id));

    expect(result.current.presentation).toMatchObject({
      status: "stable",
      state: { rotation: 90, rotationAngle: 90 },
    });
  });

  it("ignores completion from a transition replaced before it finished", () => {
    const viewportRef = { current: makeElement(800, 600) };
    const frameRef = { current: makeElement(800, 450) };
    const { rerender, result } = renderHook(
      ({ cropIsOpen, rotation }) =>
        usePreviewPresentation(
          { ...input(rotation), cropIsOpen },
          1920,
          1080,
          false,
          false,
          viewportRef,
          frameRef,
        ),
      { initialProps: { cropIsOpen: false, rotation: 0 as RotationDegrees } },
    );

    rerender({ cropIsOpen: true, rotation: 0 });
    const firstTransition = result.current.presentation;
    expect(firstTransition.status).toBe("transitioning");
    if (firstTransition.status !== "transitioning") return;

    rerender({ cropIsOpen: true, rotation: 90 });
    const replacementTransition = result.current.presentation;
    expect(replacementTransition.status).toBe("transitioning");
    if (replacementTransition.status !== "transitioning") return;
    expect(replacementTransition.id).not.toBe(firstTransition.id);

    act(() => result.current.finishTransition(firstTransition.id));
    expect(result.current.presentation).toMatchObject({
      id: replacementTransition.id,
      status: "transitioning",
    });

    act(() => result.current.finishTransition(replacementTransition.id));
    expect(result.current.presentation).toMatchObject({
      state: { cropIsOpen: true, rotation: 90 },
      status: "stable",
    });
  });
});
