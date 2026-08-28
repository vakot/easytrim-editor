export const QUARTER_SNAP_POINTS = [0, 0.25, 0.5, 0.75, 1] as const;

export function snapToNearestPoint(
  value: number,
  points: readonly number[],
  maximumDistance: number,
): number | null {
  let nearestPoint: number | null = null;
  let nearestDistance = maximumDistance;

  for (const point of points) {
    const distance = Math.abs(value - point);
    if (distance <= nearestDistance) {
      nearestPoint = point;
      nearestDistance = distance;
    }
  }

  return nearestPoint;
}
