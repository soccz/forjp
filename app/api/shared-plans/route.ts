import { getSupabaseAdminClient, hasSupabaseServerConfig } from "@/lib/supabase";
import { NextResponse } from "next/server";

export async function PATCH(req: Request) {
  const { id, stepVotes, overallApproval } = await req.json() as {
    id: string;
    stepVotes: Record<string, "love" | "okay" | "skip">;
    overallApproval: boolean;
  };
  if (!id) return NextResponse.json({ error: "missing id" }, { status: 400 });

  // Try Supabase first
  const supabase = getSupabaseAdminClient();
  if (supabase) {
    const partnerVotes = { voted_at: new Date().toISOString(), step_votes: stepVotes, overall_approval: overallApproval };
    const { error } = await supabase
      .from("shared_plans")
      .update({ partner_votes: partnerVotes })
      .eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

export async function POST(request: Request) {
  try {
    const { plan, surpriseMode } = await request.json() as { plan: unknown; surpriseMode?: boolean };
    const id = crypto.randomUUID().replace(/-/g, "").slice(0, 8);
    const payload = { plan, surpriseMode: surpriseMode ?? false, createdAt: new Date().toISOString() };

    if (hasSupabaseServerConfig()) {
      const supabase = getSupabaseAdminClient();
      if (supabase) {
        await supabase.from("shared_plans").insert({ id, payload });
      }
    }

    const origin = request.headers.get("origin") ?? "";
    return NextResponse.json({ id, url: `${origin}/?s=${id}` });
  } catch {
    return NextResponse.json({ error: "share_failed" }, { status: 500 });
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("s");
    if (!id) return NextResponse.json({ error: "missing_id" }, { status: 400 });

    if (!hasSupabaseServerConfig()) {
      return NextResponse.json({ error: "not_configured" }, { status: 503 });
    }

    const supabase = getSupabaseAdminClient();
    if (!supabase) return NextResponse.json({ error: "db_error" }, { status: 500 });

    const { data } = await supabase
      .from("shared_plans")
      .select("payload")
      .eq("id", id)
      .single();

    if (!data) return NextResponse.json({ error: "not_found" }, { status: 404 });
    const payload = data.payload as { plan?: Record<string, unknown>; surpriseMode?: boolean; createdAt?: string };
    if (payload.surpriseMode === true && payload.plan) {
      const { scores, altPanel, reason, preferenceSummary, profile, ...rest } = payload.plan as Record<string, unknown> & { profile?: Record<string, unknown> };
      void scores; void altPanel; void reason; void preferenceSummary;
      const strippedPlan = profile ? { ...rest, profile: (({ tags: _t, ...profileRest }) => profileRest)(profile) } : rest;
      return NextResponse.json({ ...payload, plan: strippedPlan });
    }
    return NextResponse.json(payload);
  } catch {
    return NextResponse.json({ error: "fetch_failed" }, { status: 500 });
  }
}
