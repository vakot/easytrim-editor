import { describe, expect, it, vi } from "vitest";

import {
  connectNativeAudioBinding,
  disconnectNativeAudioBinding,
  getOrCreateNativeAudioBinding,
} from "../native-audio-runtime";

function createAudioContextMock() {
  const createMediaElementSource = vi.fn(() => ({
    connect: vi.fn((destination: unknown) => destination),
    disconnect: vi.fn(),
  }));

  const createGain = vi.fn(() => ({
    gain: { value: 1 },
    connect: vi.fn((destination: unknown) => destination),
    disconnect: vi.fn(),
  }));

  return {
    context: { createGain, createMediaElementSource } as unknown as AudioContext,
    createGain,
    createMediaElementSource,
  };
}

describe("native audio runtime", () => {
  it("reuses one media-element source after its downstream route is disconnected", () => {
    const { context, createMediaElementSource } = createAudioContextMock();
    const bindings = new Map<HTMLVideoElement, ReturnType<typeof getOrCreateNativeAudioBinding>>();
    const video = document.createElement("video");
    const masterGain = {} as GainNode;

    const firstBinding = getOrCreateNativeAudioBinding(bindings, context, video);
    connectNativeAudioBinding(firstBinding, masterGain);
    disconnectNativeAudioBinding(firstBinding);
    const secondBinding = getOrCreateNativeAudioBinding(bindings, context, video);
    connectNativeAudioBinding(secondBinding, masterGain);

    expect(createMediaElementSource).toHaveBeenCalledOnce();
    expect(secondBinding).toBe(firstBinding);
    expect(secondBinding.connectedMaster).toBe(masterGain);
  });

  it("creates a new binding only for a different video element", () => {
    const { context, createMediaElementSource } = createAudioContextMock();
    const bindings = new Map<HTMLVideoElement, ReturnType<typeof getOrCreateNativeAudioBinding>>();

    getOrCreateNativeAudioBinding(bindings, context, document.createElement("video"));
    getOrCreateNativeAudioBinding(bindings, context, document.createElement("video"));

    expect(createMediaElementSource).toHaveBeenCalledTimes(2);
  });
});
