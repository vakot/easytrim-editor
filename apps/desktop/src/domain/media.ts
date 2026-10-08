import type { AudioLoudnessAnalysis, AudioTrackSelection } from "./audio-processing";

type LoudnessAnalysis = AudioLoudnessAnalysis;

interface AppError {
  code: string;
  diagnostics?: string;
  messageArgs?: Record<string, number | string>;
  messageId?: string;
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
  phase: "preparing" | "running" | "completed";
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

interface AudioActivityRange {
  endMicros: number;
  startMicros: number;
}

interface OptimizedExportRequest extends FastExportRequest {
  arguments: string;
  crop?: { height: number; width: number; x: number; y: number };
  flipHorizontal?: boolean;
  flipVertical?: boolean;
  frameRate?: { denominator: number; numerator: number };
  resolution: { height: number; width: number };
}

interface GifExportRequest {
  audioTracks: AudioTrackSelection[];
  crop?: { height: number; width: number; x: number; y: number };
  flipHorizontal: boolean;
  flipVertical: boolean;
  frameRate?: { denominator: number; numerator: number };
  mergeAudio: false;
  resolution: { height: number; width: number };
  rotationDegrees: import("./rotation").RotationDegrees;
  sourcePath: string;
  trim: TrimSelection;
}

interface LoudnessAnalysisRequest {
  audioTrack: AudioTrackSelection;
  sourcePath: string;
  trim: TrimSelection;
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
  AudioActivityRange,
  AudioStream,
  ChapterInfo,
  ExportProgress,
  ExportResult,
  FastExportRequest,
  FrameRate,
  GifExportRequest,
  LoudnessAnalysis,
  LoudnessAnalysisRequest,
  MediaInfo,
  OptimizedExportRequest,
  OutputSelection,
  VideoStream,
};
