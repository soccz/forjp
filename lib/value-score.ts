import type { VenueCandidate, PlanVariant } from "@/lib/types";

/** minutes of stay per 1000 KRW — higher is better value */
export function computeValueDensity(v: VenueCandidate): number {
  if (v.estimatedCost <= 0) return v.stayMinutes; // free = max value
  const costInThousands = v.estimatedCost / 1000;
  if (costInThousands < 0.1) return v.stayMinutes; // guard near-zero
  return Math.round((v.stayMinutes / costInThousands) * 10) / 10;
}

export type ValueTier = "최고" | "보통" | "고가";

export function getValueTier(density: number): ValueTier {
  if (density >= 3) return "최고";
  if (density >= 1.5) return "보통";
  return "고가";
}

/** Total value density for a plan variant */
export function variantValueScore(variant: PlanVariant): number {
  if (!variant.candidates.length) return 0;
  const totalMinutes = variant.totalMinutes;
  const totalCost = variant.totalCost;
  if (totalCost <= 0) return totalMinutes;
  const costInThousands = totalCost / 1000;
  if (costInThousands < 0.1) return totalMinutes; // guard near-zero
  return Math.round((totalMinutes / costInThousands) * 10) / 10;
}
