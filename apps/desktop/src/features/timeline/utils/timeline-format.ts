export function formatAccessibleTime(micros: number): string {
  return (micros / 1_000_000).toFixed(3);
}
