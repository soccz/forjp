import { getSupabaseAdminClient, hasSupabaseServerConfig } from "@/lib/supabase";
import type { SavedPlan } from "@/lib/types";

type SavedPlanRow = {
  id: string;
  owner_key: string;
  scenario_id: SavedPlan["scenarioId"];
  label: string;
  mode: SavedPlan["mode"];
  score: number;
  saved_at: string;
  preferences: SavedPlan["preferences"];
  step_ids: string[];
  swap_alternative: boolean;
  custom_config?: SavedPlan["customConfig"] | null;
};

function mapRowToSavedPlan(row: SavedPlanRow): SavedPlan {
  return {
    id: row.id,
    scenarioId: row.scenario_id,
    label: row.label,
    mode: row.mode,
    score: row.score,
    savedAt: row.saved_at,
    preferences: row.preferences,
    stepIds: row.step_ids,
    swapAlternative: row.swap_alternative,
    customConfig: row.custom_config ?? undefined,
  };
}

export async function listSavedPlans(ownerKey: string) {
  if (!hasSupabaseServerConfig()) {
    return { plans: [] as SavedPlan[], source: "local" as const };
  }

  const supabase = getSupabaseAdminClient();

  if (!supabase) {
    return { plans: [] as SavedPlan[], source: "local" as const };
  }

  const { data, error } = await supabase
    .from("saved_plans")
    .select("id, owner_key, scenario_id, label, mode, score, saved_at, preferences, step_ids, swap_alternative, custom_config")
    .eq("owner_key", ownerKey)
    .order("saved_at", { ascending: false })
    .limit(5);

  if (error) {
    throw error;
  }

  return {
    plans: (data ?? []).map((row) => mapRowToSavedPlan(row as SavedPlanRow)),
    source: "supabase" as const,
  };
}

export async function createSavedPlan(ownerKey: string, plan: SavedPlan) {
  if (!hasSupabaseServerConfig()) {
    return { plan, source: "local" as const };
  }

  const supabase = getSupabaseAdminClient();

  if (!supabase) {
    return { plan, source: "local" as const };
  }

  const payload = {
    id: plan.id,
    owner_key: ownerKey,
    scenario_id: plan.scenarioId,
    label: plan.label,
    mode: plan.mode,
    score: plan.score,
    saved_at: plan.savedAt,
    preferences: plan.preferences,
    step_ids: plan.stepIds,
    swap_alternative: plan.swapAlternative,
    custom_config: plan.customConfig ?? null,
  };

  const { data: existing, error: countError } = await supabase
    .from("saved_plans")
    .select("id, saved_at")
    .eq("owner_key", ownerKey)
    .order("saved_at", { ascending: true });

  if (!countError && existing && existing.length >= 5) {
    const toDelete = existing.slice(0, existing.length - 4);
    await supabase
      .from("saved_plans")
      .delete()
      .in("id", toDelete.map((r) => r.id));
  }

  const { error } = await supabase.from("saved_plans").insert(payload);

  if (error) {
    throw error;
  }

  return { plan, source: "supabase" as const };
}
