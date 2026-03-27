export function captureError(error: unknown, context?: Record<string, unknown>) {
  const err = error instanceof Error ? error : new Error(String(error));

  if (typeof window !== "undefined") {
    const w = window as unknown as { Sentry?: { captureException: (e: Error, ctx?: unknown) => void } };
    if (w.Sentry) {
      w.Sentry.captureException(err, { extra: context });
      return;
    }
  }

  console.error("[monitoring]", err.message, context ?? "");
}
