import type { ActivityCategory, PlanVariant, VenueCandidate } from "@/lib/types";
import { optimizeRoute } from "@/lib/route-optimizer";

function pickBestPerCategory(
  candidates: VenueCandidate[],
  categories: ActivityCategory[],
  scorer: (v: VenueCandidate) => number
): VenueCandidate[] {
  return categories
    .map((cat) => {
      const pool = candidates.filter((c) => c.category === cat);
      if (!pool.length) return null;
      return pool.reduce((best, c) => (scorer(c) > scorer(best) ? c : best));
    })
    .filter((v): v is VenueCandidate => v !== null);
}

export function buildPlanVariants(
  candidates: VenueCandidate[],
  categories: ActivityCategory[],
  origin: { latitude: number; longitude: number }
): PlanVariant[] {
  // 효율 코스: minimize travel time
  const efficientPicks = pickBestPerCategory(
    candidates,
    categories,
    (v) => -v.travelMinutes
  );
  const efficientOrdered = optimizeRoute(origin, efficientPicks).optimalOrder;

  // 감성 코스: maximize visual + quiet scores
  const moodPicks = pickBestPerCategory(
    candidates,
    categories,
    (v) => v.visualScore + v.quietScore
  );
  const moodOrdered = optimizeRoute(origin, moodPicks).optimalOrder;

  // 여유 코스: maximize stay time, minimize cost
  const relaxedPicks = pickBestPerCategory(
    candidates,
    categories,
    (v) => v.stayMinutes - v.estimatedCost / 5000
  );
  const relaxedOrdered = optimizeRoute(origin, relaxedPicks).optimalOrder;

  return [
    {
      theme: "efficient",
      label: "효율 코스",
      tagline: "이동 최소, 동선 깔끔",
      candidates: efficientOrdered,
      totalCost: efficientOrdered.reduce((s, v) => s + v.estimatedCost, 0),
      totalMinutes:
        efficientOrdered.reduce((s, v) => s + v.stayMinutes + v.travelMinutes, 0),
    },
    {
      theme: "mood",
      label: "감성 코스",
      tagline: "분위기와 사진 포인트 중심",
      candidates: moodOrdered,
      totalCost: moodOrdered.reduce((s, v) => s + v.estimatedCost, 0),
      totalMinutes:
        moodOrdered.reduce((s, v) => s + v.stayMinutes + v.travelMinutes, 0),
    },
    {
      theme: "relaxed",
      label: "여유 코스",
      tagline: "천천히, 오래 머무는 흐름",
      candidates: relaxedOrdered,
      totalCost: relaxedOrdered.reduce((s, v) => s + v.estimatedCost, 0),
      totalMinutes:
        relaxedOrdered.reduce((s, v) => s + v.stayMinutes + v.travelMinutes, 0),
    },
  ];
}
