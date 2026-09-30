function audioTrackColor(streamIndex: number): string {
  const hue = (Math.abs(streamIndex) * 137.508) % 360;
  return `hsl(${hue.toFixed(1)} 72% 52%)`;
}

export { audioTrackColor };
