const DEG_TO_RAD = Math.PI / 180;
const EARTH_RADIUS_M = 6_371_000;

export function haversineDistance(
  lng1: number, lat1: number,
  lng2: number, lat2: number,
): number {
  const dLat = (lat2 - lat1) * DEG_TO_RAD;
  const dLng = (lng2 - lng1) * DEG_TO_RAD;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * DEG_TO_RAD) * Math.cos(lat2 * DEG_TO_RAD) *
    Math.sin(dLng / 2) ** 2;
  return EARTH_RADIUS_M * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function computeSegmentDistances(
  coords: [number, number][],
): { cumulative: number[]; total: number } {
  const cumulative = [0];
  for (let i = 1; i < coords.length; i++) {
    const d = haversineDistance(
      coords[i - 1][0], coords[i - 1][1],
      coords[i][0], coords[i][1],
    );
    cumulative.push(cumulative[i - 1] + d);
  }
  return { cumulative, total: cumulative[cumulative.length - 1] };
}

export function interpolateAlongRoute(
  coords: [number, number][],
  cumulative: number[],
  totalDistance: number,
  fraction: number,
): { lng: number; lat: number } {
  const f = Math.max(0, Math.min(1, fraction));
  if (f === 0) return { lng: coords[0][0], lat: coords[0][1] };
  if (f === 1) {
    const last = coords[coords.length - 1];
    return { lng: last[0], lat: last[1] };
  }

  const targetDist = f * totalDistance;

  // Binary search for the segment
  let lo = 0;
  let hi = cumulative.length - 1;
  while (lo < hi - 1) {
    const mid = (lo + hi) >> 1;
    if (cumulative[mid] <= targetDist) lo = mid;
    else hi = mid;
  }

  const segLen = cumulative[hi] - cumulative[lo];
  const segFrac = segLen > 0 ? (targetDist - cumulative[lo]) / segLen : 0;

  return {
    lng: coords[lo][0] + segFrac * (coords[hi][0] - coords[lo][0]),
    lat: coords[lo][1] + segFrac * (coords[hi][1] - coords[lo][1]),
  };
}

export function reverseCoordinates(
  coords: [number, number][],
): [number, number][] {
  return [...coords].reverse();
}

/**
 * Slice coords from the point nearest to `fraction` of the way through,
 * then reverse -- used for cancellation mid-trip return.
 */
export function sliceAndReverse(
  coords: [number, number][],
  cumulative: number[],
  totalDistance: number,
  fraction: number,
): { coords: [number, number][]; cumulative: number[]; total: number } {
  const targetDist = Math.max(0, Math.min(1, fraction)) * totalDistance;

  // Find the segment index
  let idx = 0;
  for (let i = 1; i < cumulative.length; i++) {
    if (cumulative[i] > targetDist) { idx = i - 1; break; }
    idx = i;
  }

  // Interpolate the exact current point
  const segLen = idx < cumulative.length - 1 ? cumulative[idx + 1] - cumulative[idx] : 0;
  const segFrac = segLen > 0 ? (targetDist - cumulative[idx]) / segLen : 0;
  const currentPoint: [number, number] = [
    coords[idx][0] + segFrac * ((coords[idx + 1]?.[0] ?? coords[idx][0]) - coords[idx][0]),
    coords[idx][1] + segFrac * ((coords[idx + 1]?.[1] ?? coords[idx][1]) - coords[idx][1]),
  ];

  // Take all coords from start up to idx, plus the interpolated point, then reverse
  const slice: [number, number][] = [...coords.slice(0, idx + 1), currentPoint].reverse();
  const result = computeSegmentDistances(slice);
  return { coords: slice, ...result };
}
