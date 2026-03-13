import { NextResponse } from "next/server";
import { createSavedPlan, listSavedPlans } from "@/lib/saved-plan-store";
import type { SavedPlan } from "@/lib/types";

type SavedPlanRequestBody = {
  ownerKey?: string;
  plan?: SavedPlan;
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const ownerKey = searchParams.get("ownerKey");

  if (!ownerKey) {
    return NextResponse.json({ message: "ownerKey is required" }, { status: 400 });
  }

  try {
    const response = await listSavedPlans(ownerKey);
    return NextResponse.json(response);
  } catch {
    return NextResponse.json({ message: "failed_to_list_saved_plans" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const body = (await request.json()) as SavedPlanRequestBody;

  if (!body.ownerKey || !body.plan) {
    return NextResponse.json({ message: "ownerKey and plan are required" }, { status: 400 });
  }

  try {
    const response = await createSavedPlan(body.ownerKey, body.plan);
    return NextResponse.json(response);
  } catch {
    return NextResponse.json({ message: "failed_to_create_saved_plan" }, { status: 500 });
  }
}
