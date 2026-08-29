export interface NativeAudioBinding {
  source: MediaElementAudioSourceNode;
  gain: GainNode;
  connectedMaster: GainNode | null;
}
