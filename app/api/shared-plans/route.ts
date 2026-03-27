import { getSupabaseAdminClient, hasSupabaseServerConfig } from "@/lib/supabase";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const payload = await request.json() as Record<string, unknown>;
    const id = crypto.randomUUID().replace(/-/g, "").slice(0, 8);

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
    return NextResponse.json(data.payload);
  } catch {
    return NextResponse.json({ error: "fetch_failed" }, { status: 500 });
  }
}
