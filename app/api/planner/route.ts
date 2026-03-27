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
  try {
    return NextResponse.json(getPlannerState({ scenarioId: "afterwork", mode: "j" }));
  } catch {
    return NextResponse.json({ error: "planner_failed" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as PlannerRequestBody;
    const planner = getPlannerState({
      scenarioId: body.scenarioId ?? "afterwork",
      mode: body.mode ?? "j",
      stepIds: body.stepIds,
      swapAlternative: body.swapAlternative,
      preferences: body.preferences,
    });

    return NextResponse.json(planner);
  } catch {
    return NextResponse.json({ error: "planner_failed" }, { status: 500 });
  }
}
