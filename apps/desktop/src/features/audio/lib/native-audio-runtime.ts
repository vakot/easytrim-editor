interface NativeAudioBinding {
  connectedMaster: GainNode | null;
  gain: GainNode;
  source: MediaElementAudioSourceNode;
}

function getOrCreateNativeAudioBinding(
  bindings: Map<HTMLVideoElement, NativeAudioBinding>,
  context: AudioContext,
  element: HTMLVideoElement,
): NativeAudioBinding {
  const existingBinding = bindings.get(element);
  if (existingBinding) return existingBinding;

  const binding: NativeAudioBinding = {
    source: context.createMediaElementSource(element),
    gain: context.createGain(),
    connectedMaster: null,
  };

  bindings.set(element, binding);
  return binding;
}

function connectNativeAudioBinding(binding: NativeAudioBinding, masterGain: GainNode): void {
  if (binding.connectedMaster === masterGain) return;
  binding.source.disconnect();
  binding.gain.disconnect();
  binding.source.connect(binding.gain).connect(masterGain);
  binding.connectedMaster = masterGain;
}

function disconnectNativeAudioBinding(binding: NativeAudioBinding): void {
  binding.source.disconnect();
  binding.gain.disconnect();
  binding.connectedMaster = null;
}

export { connectNativeAudioBinding, disconnectNativeAudioBinding, getOrCreateNativeAudioBinding };

export type { NativeAudioBinding };
