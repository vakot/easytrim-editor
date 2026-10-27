import editor1280 from "../assets/screenshots/editor-1280.webp";
import editor1920 from "../assets/screenshots/editor-1920.webp";
import editor2560 from "../assets/screenshots/editor-2560.webp";
import queue480 from "../assets/screenshots/queue-480.webp";
import queue748 from "../assets/screenshots/queue-748.webp";
import timeline960 from "../assets/screenshots/timeline-960.webp";
import timeline1900 from "../assets/screenshots/timeline-1900.webp";

/** One responsive screenshot. Width and height are the largest file's, so the page never shifts. */
type Screenshot = {
  alt: string;
  height: number;
  src: string;
  srcSet: string;
  width: number;
};

const editorScreenshot: Screenshot = {
  alt: "The EasyTrim Editor workspace: imported sources and the export queue on the left, the video preview, and the timeline with a selected segment and its audio waveform below.",
  height: 1440,
  src: editor1920,
  srcSet: `${editor1280} 1280w, ${editor1920} 1920w, ${editor2560} 2560w`,
  width: 2560,
};

const timelineScreenshot: Screenshot = {
  alt: "The timeline with a selected segment, its timecodes, trimming tools, playback controls, and the audio track's waveform.",
  height: 414,
  src: timeline1900,
  srcSet: `${timeline960} 960w, ${timeline1900} 1900w`,
  width: 1900,
};

const queueScreenshot: Screenshot = {
  alt: "An imported source with six queued exports, including an optimized MP4 and a lossless MKV cut, and the Start queue button.",
  height: 700,
  src: queue748,
  srcSet: `${queue480} 480w, ${queue748} 748w`,
  width: 748,
};

export type { Screenshot };
export { editorScreenshot, queueScreenshot, timelineScreenshot };
