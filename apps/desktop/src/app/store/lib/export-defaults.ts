function outputDefaults(sourceName: string) {
  const stem = sourceName.replace(/\.[^/.]+$/, "") || "clip";
  return { fast: `${stem}-cut.mkv`, gif: `${stem}-gif.gif`, optimized: `${stem}-optimized.mp4` };
}

export { outputDefaults };
