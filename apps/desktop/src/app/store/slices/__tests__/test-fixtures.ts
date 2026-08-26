import type { MediaInfo } from "@/lib/tauri/media";
import type { SourceRef } from "@/domain/source";

export const firstSource: SourceRef = {
  displayName: "first.mp4",
  sourcePath: "C:/Media/first.mp4",
};
export const secondSource: SourceRef = {
  displayName: "second.mkv",
  sourcePath: "C:/Media/second.mkv",
};

export function media(sourcePath: string): MediaInfo {
  void sourcePath;
  return {
    formatName: "matroska,webm",
    formatLongName: "Matroska / WebM",
    durationMicros: 5_000_000,
    sizeBytes: 1_000,
    bitrate: 8_000,
    video: {
      streamIndex: 0,
      codecName: "h264",
      width: 1920,
      height: 1080,
      averageFrameRate: { numerator: 30_000, denominator: 1_001, displayValue: 29.97 },
    },
    audioStreams: [],
    chapters: [],
  };
}

export function mediaWithAudio(sourcePath: string): MediaInfo {
  return {
    ...media(sourcePath),
    audioStreams: [
      {
        streamIndex: 2,
        codecName: "aac",
        channels: 2,
        channelLayout: "stereo",
        language: "eng",
        isDefault: true,
      },
      {
        streamIndex: 4,
        codecName: "ac3",
        channels: 6,
        channelLayout: "5.1",
        title: "Surround",
        isDefault: false,
      },
    ],
  };
}
