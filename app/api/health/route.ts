import { NextResponse } from "next/server";
import { getRuntimeDiagnostics } from "@/lib/runtime-config";

export async function GET() {
  const diagnostics = getRuntimeDiagnostics();

  return NextResponse.json({
    status: diagnostics.readyForLive ? "ready" : "setup_required",
    diagnostics,
    timestamp: new Date().toISOString(),
  });
}
