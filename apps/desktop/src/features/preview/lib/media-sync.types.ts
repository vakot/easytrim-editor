export type PlaybackFrameHandle =
  { kind: "video"; id: number; video: HTMLVideoElement } | { kind: "animation"; id: number };
