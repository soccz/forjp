import { NextResponse } from "next/server";
import { defaultPreferences } from "@/lib/planner";
import { getRecommendation } from "@/lib/recommendation-engine";
import type { ActivityCategory, RecommendationRequest, UserPreferences } from "@/lib/types";

type RecommendationBody = {
  district?: string;
  originLabel?: string;
  categories?: ActivityCategory[];
  preferences?: Partial<UserPreferences>;
  selectedCandidateIds?: string[];
};

export async function POST(request: Request) {
  const body = (await request.json()) as RecommendationBody;

  const payload: RecommendationRequest = {
    district: body.district ?? "성수",
    originLabel: body.originLabel ?? "현재 위치",
    categories: body.categories?.length ? body.categories : ["movie", "cafe", "dinner"],
    preferences: {
      budgetCap: body.preferences?.budgetCap ?? defaultPreferences.budgetCap,
      walkPreference: body.preferences?.walkPreference ?? defaultPreferences.walkPreference,
      vibePreference: body.preferences?.vibePreference ?? defaultPreferences.vibePreference,
      indoorPriority: body.preferences?.indoorPriority ?? defaultPreferences.indoorPriority,
    },
    selectedCandidateIds: body.selectedCandidateIds,
  };

  const recommendation = await getRecommendation(payload);
  return NextResponse.json(recommendation);
}
