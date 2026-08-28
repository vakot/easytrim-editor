export interface NativeAudioBinding {
  source: MediaElementAudioSourceNode;
  gain: GainNode;
  connectedMaster: GainNode | null;
}

export function getOrCreateNativeAudioBinding(
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

export function connectNativeAudioBinding(binding: NativeAudioBinding, masterGain: GainNode): void {
  if (binding.connectedMaster === masterGain) return;
  binding.source.disconnect();
  binding.gain.disconnect();
  binding.source.connect(binding.gain).connect(masterGain);
  binding.connectedMaster = masterGain;
}

export function disconnectNativeAudioBinding(binding: NativeAudioBinding): void {
  binding.source.disconnect();
  binding.gain.disconnect();
  binding.connectedMaster = null;
}
