import { NextResponse } from "next/server";
import { getSeoulWeather } from "@/lib/weather";
import { getSupabaseAdminClient } from "@/lib/supabase";

const CACHE_KEY = "weather:seoul:current";
const CACHE_TTL_SECONDS = 1800; // 30 minutes

export async function GET() {
  // Try Supabase cache first
  const supabase = getSupabaseAdminClient();
  if (supabase) {
    const { data } = await supabase
      .from("api_cache")
      .select("payload, expires_at")
      .eq("cache_key", CACHE_KEY)
      .single();

    if (data && new Date(data.expires_at) > new Date()) {
      return NextResponse.json({ ...data.payload, cached: true });
    }
  }

  // Fetch fresh
  const weather = await getSeoulWeather();
  if (!weather) {
    return NextResponse.json({ error: "weather_unavailable" }, { status: 503 });
  }

  // Store in Supabase cache
  if (supabase) {
    const expiresAt = new Date(Date.now() + CACHE_TTL_SECONDS * 1000).toISOString();
    await supabase.from("api_cache").upsert({
      cache_key: CACHE_KEY,
      payload: weather,
      expires_at: expiresAt,
      updated_at: new Date().toISOString(),
    });
  }

  return NextResponse.json({ ...weather, cached: false });
}
