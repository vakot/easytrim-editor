import editor1280 from "../assets/screenshots/editor-1280.webp";
import editor1920 from "../assets/screenshots/editor-1920.webp";
import editor2560 from "../assets/screenshots/editor-2560.webp";
import sources520 from "../assets/screenshots/sources-520.webp";
import sources1032 from "../assets/screenshots/sources-1032.webp";
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
  alt: "The EasyTrim Editor workspace: imported sources and workspace history on the left, the video preview with the Export Queue, Fast Export, and Optimized Export actions above it, and the timeline with a selected segment and its audio waveform below.",
  height: 1440,
  src: editor1920,
  srcSet: `${editor1280} 1280w, ${editor1920} 1920w, ${editor2560} 2560w`,
  width: 2560,
};

const timelineScreenshot: Screenshot = {
  alt: "The timeline with a selected segment, its start, end, and duration timecodes, playback controls, tools, audio level meters, and the audio track's waveform.",
  height: 412,
  src: timeline1900,
  srcSet: `${timeline960} 960w, ${timeline1900} 1900w`,
  width: 1900,
};

const sourcesScreenshot: Screenshot = {
  alt: "The Imported Sources list with a search field and four videos, each with a thumbnail, duration, file size, and date; one is flagged as deleted from disk.",
  height: 1120,
  src: sources1032,
  srcSet: `${sources520} 520w, ${sources1032} 1032w`,
  width: 1032,
};

export type { Screenshot };
export { editorScreenshot, sourcesScreenshot, timelineScreenshot };
