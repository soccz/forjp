import { NextResponse } from "next/server";
import { getPlannerState } from "@/lib/planner";
import type { PlannerMode, ScenarioId, UserPreferences } from "@/lib/types";

type PlannerRequestBody = {
  mode?: PlannerMode;
  scenarioId?: ScenarioId;
  stepIds?: string[];
  swapAlternative?: boolean;
  preferences?: Partial<UserPreferences>;
};

export async function GET() {
  return NextResponse.json(getPlannerState({ scenarioId: "afterwork", mode: "j" }));
}

export async function POST(request: Request) {
  const body = (await request.json()) as PlannerRequestBody;
  const planner = getPlannerState({
    scenarioId: body.scenarioId ?? "afterwork",
    mode: body.mode ?? "j",
    stepIds: body.stepIds,
    swapAlternative: body.swapAlternative,
    preferences: body.preferences,
  });

  return NextResponse.json(planner);
}
