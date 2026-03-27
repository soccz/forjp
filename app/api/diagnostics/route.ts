import { NextResponse } from "next/server";
import { getProviderDiagnostics } from "@/lib/recommendation-engine";
import { getRuntimeDiagnostics } from "@/lib/runtime-config";

export async function GET() {
  try {
    const providerDiagnostics = getProviderDiagnostics();
    const runtimeDiagnostics = getRuntimeDiagnostics();

    return NextResponse.json({
      ...providerDiagnostics,
      readyForLive: runtimeDiagnostics.readyForLive,
      setupSteps: runtimeDiagnostics.setupSteps,
      issues: runtimeDiagnostics.issues,
    });
  } catch {
    return NextResponse.json({ error: "diagnostics_failed" }, { status: 500 });
  }
}
