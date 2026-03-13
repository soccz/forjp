import { NextResponse } from "next/server";
import { buildCustomPlanner, defaultPreferences } from "@/lib/planner";
import { getRecommendation } from "@/lib/recommendation-engine";
import type { ActivityCategory, CustomPlannerRequest, UserPreferences } from "@/lib/types";

type CustomPlanBody = {
  district?: string;
  originLabel?: string;
  categories?: ActivityCategory[];
  mode?: CustomPlannerRequest["mode"];
  preferences?: Partial<UserPreferences>;
  stepIds?: string[];
  selectedCandidateIds?: string[];
};

export async function POST(request: Request) {
  const body = (await request.json()) as CustomPlanBody;

  const payload: CustomPlannerRequest = {
    district: body.district ?? "성수",
    originLabel: body.originLabel ?? "현재 위치",
    categories: body.categories?.length ? body.categories : ["movie", "cafe", "dinner"],
    mode: body.mode ?? "j",
    preferences: {
      budgetCap: body.preferences?.budgetCap ?? defaultPreferences.budgetCap,
      walkPreference: body.preferences?.walkPreference ?? defaultPreferences.walkPreference,
      vibePreference: body.preferences?.vibePreference ?? defaultPreferences.vibePreference,
      indoorPriority: body.preferences?.indoorPriority ?? defaultPreferences.indoorPriority,
    },
    selectedCandidateIds: body.selectedCandidateIds,
  };

  const recommendation = await getRecommendation(payload);
  const orderedRecommendation =
    body.stepIds && body.stepIds.length === recommendation.candidates.length
      ? {
          ...recommendation,
          candidates: body.stepIds
            .map((stepId) => recommendation.candidates.find((candidate) => candidate.id === stepId))
            .filter((candidate): candidate is (typeof recommendation.candidates)[number] => Boolean(candidate)),
        }
      : recommendation;
  const planner = buildCustomPlanner({
    recommendation: orderedRecommendation,
    district: payload.district,
    originLabel: payload.originLabel,
    categories: payload.categories,
    mode: payload.mode,
    preferences: payload.preferences,
  });

  return NextResponse.json(planner);
}
