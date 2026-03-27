import type { VenueCandidate } from "@/lib/types";

function haversineKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function totalRouteKm(
  origin: { latitude: number; longitude: number },
  venues: VenueCandidate[]
): number {
  let total = 0;
  let prev = origin;
  for (const v of venues) {
    total += haversineKm(prev.latitude, prev.longitude, v.latitude, v.longitude);
    prev = v;
  }
  return total;
}

function permutations<T>(arr: T[]): T[][] {
  if (arr.length <= 1) return [arr];
  return arr.flatMap((item, i) =>
    permutations([...arr.slice(0, i), ...arr.slice(i + 1)]).map((perm) => [
      item,
      ...perm,
    ])
  );
}

export type RouteOptimizationResult = {
  optimalOrder: VenueCandidate[];
  currentDistanceKm: number;
  optimalDistanceKm: number;
  savingMinutes: number;
  isAlreadyOptimal: boolean;
};

export function optimizeRoute(
  origin: { latitude: number; longitude: number },
  venues: VenueCandidate[]
): RouteOptimizationResult {
  if (venues.length <= 1) {
    const d = totalRouteKm(origin, venues);
    return {
      optimalOrder: venues,
      currentDistanceKm: d,
      optimalDistanceKm: d,
      savingMinutes: 0,
      isAlreadyOptimal: true,
    };
  }

  // Brute-force is O(n!): cap at 8 venues to prevent browser hang
  if (venues.length > 8) {
    const d = totalRouteKm(origin, venues);
    return {
      optimalOrder: venues,
      currentDistanceKm: d,
      optimalDistanceKm: d,
      savingMinutes: 0,
      isAlreadyOptimal: true,
    };
  }

  const currentDistanceKm = totalRouteKm(origin, venues);
  const perms = permutations(venues);

  let best = venues;
  let bestKm = currentDistanceKm;

  for (const perm of perms) {
    const d = totalRouteKm(origin, perm);
    if (d < bestKm) {
      bestKm = d;
      best = perm;
    }
  }

  const isAlreadyOptimal = best.every((v, i) => v.id === venues[i].id);
  // rough estimate: 1km ≈ 3min by subway
  const savingMinutes = Math.round((currentDistanceKm - bestKm) * 3);

  return {
    optimalOrder: best,
    currentDistanceKm,
    optimalDistanceKm: bestKm,
    savingMinutes,
    isAlreadyOptimal,
  };
}
