function findPreviousMarker(markersMicros: readonly number[], playheadMicros: number) {
  return markersMicros.reduce<number | undefined>(
    (nearest, marker) =>
      marker < playheadMicros && (nearest === undefined || marker > nearest) ? marker : nearest,
    undefined,
  );
}

function findNextMarker(markersMicros: readonly number[], playheadMicros: number) {
  return markersMicros.reduce<number | undefined>(
    (nearest, marker) =>
      marker > playheadMicros && (nearest === undefined || marker < nearest) ? marker : nearest,
    undefined,
  );
}

export { findNextMarker, findPreviousMarker };
