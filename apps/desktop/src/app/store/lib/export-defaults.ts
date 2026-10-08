function outputDefaults(sourceName: string) {
  const stem = sourceName.replace(/\.[^/.]+$/, "") || "clip";
  return {
    audio: `${stem}-audio.m4a`,
    fast: `${stem}-cut.mkv`,
    optimized: `${stem}-optimized.mp4`,
  };
}

export { outputDefaults };
