export interface AppError {
  code: string;
  diagnostics?: string;
  message: string;
}

interface TrimSelection {
  endMicros: number;
  startMicros: number;
}

export interface ExportProgress {
  bitrate?: string;
  elapsedMicros: number;
  fps?: string;
  frame?: number;
  operationId: string;
  phase: "running" | "completed";
  speed?: string;
  totalSize?: number;
}

export interface OutputSelection {
  displayName: string;
  displayPath: string;
  outputId: string;
}

export interface ExportResult {
  displayName: string;
  displayPath: string;
  operationId: string;
}

export interface FastExportRequest {
  audioTracks: AudioTrackSelection[];
  mergeAudio: boolean;
  sourcePath: string;
  trim: TrimSelection;
}

interface AudioTrackSelection {
  streamIndex: number;
  volumePercent: number;
}

export interface OptimizedExportRequest extends FastExportRequest {
  arguments: string;
  crop?: { height: number; width: number; x: number; y: number };
  frameRate?: { denominator: number; numerator: number };
  resolution: { height: number; width: number };
}

export interface FrameRate {
  denominator: number;
  displayValue?: number;
  numerator: number;
}

export interface VideoStream {
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

export interface AudioStream {
  channelLayout?: string;
  channels?: number;
  codecName: string;
  isDefault: boolean;
  language?: string;
  sampleRateHz?: number;
  streamIndex: number;
  title?: string;
}

export interface ChapterInfo {
  endMicros: number;
  id: number;
  startMicros: number;
  title?: string;
}

export interface MediaInfo {
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
