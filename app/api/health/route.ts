import { NextResponse } from "next/server";
import { getRuntimeDiagnostics } from "@/lib/runtime-config";

export async function GET() {
  try {
    const diagnostics = getRuntimeDiagnostics();

    return NextResponse.json({
      status: diagnostics.readyForLive ? "ready" : "setup_required",
      diagnostics,
      timestamp: new Date().toISOString(),
    });
  } catch {
    return NextResponse.json({ error: "health_check_failed" }, { status: 500 });
  }
}
