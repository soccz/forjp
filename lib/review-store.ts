import { getSupabaseAdminClient, hasSupabaseServerConfig } from "@/lib/supabase";
import type { ReviewSummary, ReviewSummaryRecord, VenueCandidate } from "@/lib/types";

type ReviewSummaryRow = {
  venue_key: string;
  venue_name: string;
  district: string;
  summary: ReviewSummary;
  updated_at: string;
};

function buildVenueKey(candidate: VenueCandidate) {
  return `${candidate.district}:${candidate.name}`.toLowerCase();
}

function mapRow(row: ReviewSummaryRow): ReviewSummaryRecord {
  return {
    venueKey: row.venue_key,
    venueName: row.venue_name,
    district: row.district,
    summary: row.summary,
    updatedAt: row.updated_at,
  };
}

export async function getStoredReviewSummary(candidate: VenueCandidate) {
  if (!hasSupabaseServerConfig()) {
    return null;
  }

  const supabase = getSupabaseAdminClient();

  if (!supabase) {
    return null;
  }

  const venueKey = buildVenueKey(candidate);
  const { data, error } = await supabase
    .from("place_review_summaries")
    .select("venue_key, venue_name, district, summary, updated_at")
    .eq("venue_key", venueKey)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return mapRow(data as ReviewSummaryRow);
}

export async function upsertReviewSummary(record: ReviewSummaryRecord) {
  if (!hasSupabaseServerConfig()) {
    return;
  }

  const supabase = getSupabaseAdminClient();

  if (!supabase) {
    return;
  }

  await supabase.from("place_review_summaries").upsert(
    {
      venue_key: record.venueKey,
      venue_name: record.venueName,
      district: record.district,
      summary: record.summary,
      updated_at: record.updatedAt,
    },
    { onConflict: "venue_key" }
  );
}

export function getReviewVenueKey(candidate: VenueCandidate) {
  return buildVenueKey(candidate);
}
