interface AppError {
  code: string;
  diagnostics?: string;
  message: string;
}

interface TrimSelection {
  endMicros: number;
  startMicros: number;
}

interface ExportProgress {
  bitrate?: string;
  elapsedMicros: number;
  fps?: string;
  frame?: number;
  operationId: string;
  phase: "running" | "completed";
  speed?: string;
  totalSize?: number;
}

interface OutputSelection {
  displayName: string;
  displayPath: string;
  outputId: string;
}

interface ExportResult {
  displayName: string;
  displayPath: string;
  operationId: string;
}

interface FastExportRequest {
  audioTracks: AudioTrackSelection[];
  mergeAudio: boolean;
  rotationDegrees: import("./rotation").RotationDegrees;
  sourcePath: string;
  trim: TrimSelection;
}

interface AudioTrackSelection {
  streamIndex: number;
  volumePercent: number;
}

interface OptimizedExportRequest extends FastExportRequest {
  arguments: string;
  crop?: { height: number; width: number; x: number; y: number };
  flipHorizontal?: boolean;
  flipVertical?: boolean;
  frameRate?: { denominator: number; numerator: number };
  resolution: { height: number; width: number };
}

interface FrameRate {
  denominator: number;
  displayValue?: number;
  numerator: number;
}

interface VideoStream {
  averageFrameRate?: FrameRate;
  codecName: string;
  codedHeight?: number;
  codedWidth?: number;
  colorPrimaries?: string;
  colorSpace?: string;
  colorTransfer?: string;
  height: number;
  pixelFormat?: string;
  realFrameRate?: FrameRate;
  rotationDegrees?: number;
  sampleAspectRatio?: string;
  streamIndex: number;
  timeBase?: string;
  width: number;
}

interface AudioStream {
  channelLayout?: string;
  channels?: number;
  codecName: string;
  isDefault: boolean;
  language?: string;
  sampleRateHz?: number;
  streamIndex: number;
  title?: string;
}

interface ChapterInfo {
  endMicros: number;
  id: number;
  startMicros: number;
  title?: string;
}

interface MediaInfo {
  audioStreams: AudioStream[];
  bitrate?: number;
  chapters: ChapterInfo[];
  durationMicros: number;
  formatLongName?: string;
  formatName: string;
  sizeBytes?: number;
  startTimeMicros?: number;
  video: VideoStream;
}

export type {
  AppError,
  AudioStream,
  ChapterInfo,
  ExportProgress,
  ExportResult,
  FastExportRequest,
  FrameRate,
  MediaInfo,
  OptimizedExportRequest,
  OutputSelection,
  VideoStream,
};
