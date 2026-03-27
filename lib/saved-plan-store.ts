import { getSupabaseAdminClient, hasSupabaseServerConfig } from "@/lib/supabase";
import type { SavedPlan } from "@/lib/types";

const LOCAL_KEY = "couple_saved_plans";

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
    const { error: deleteError } = await supabase
      .from("saved_plans")
      .delete()
      .in("id", toDelete.map((r) => r.id));
    if (deleteError) throw deleteError;
  }

  const { error } = await supabase.from("saved_plans").insert(payload);

  if (error) {
    throw error;
  }

  return { plan, source: "supabase" as const };
}

export function getRecentlyVisitedVenueIds(_ownerKey: string, limit = 3): string[] {
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    if (!raw) return [];
    const plans: SavedPlan[] = JSON.parse(raw);
    // Get venue IDs from most recent N plans
    return plans
      .sort((a, b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime())
      .slice(0, limit)
      .flatMap(p => p.stepIds ?? []);
  } catch {
    return [];
  }
}

export function getMostVisitedDistrict(_ownerKey: string): string | null {
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    if (!raw) return null;
    const plans: SavedPlan[] = JSON.parse(raw);
    const districtCounts: Record<string, number> = {};
    for (const p of plans) {
      const d = p.customConfig?.district;
      if (d) districtCounts[d] = (districtCounts[d] ?? 0) + 1;
    }
    const entries = Object.entries(districtCounts);
    if (!entries.length) return null;
    return entries.sort((a, b) => b[1] - a[1])[0][0];
  } catch {
    return null;
  }
}
