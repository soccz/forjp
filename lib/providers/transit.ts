import type { ProviderStatus, VenueCandidate } from "@/lib/types";
import { getRuntimeDiagnostics } from "@/lib/runtime-config";

export type TransitProvider = {
  label: string;
  isLive: boolean;
  applyTravelTimes(origin: { latitude: number; longitude: number }, candidates: VenueCandidate[]): Promise<VenueCandidate[]>;
};

const fallbackDistrictCenters: Record<string, { latitude: number; longitude: number }> = {
  성수: { latitude: 37.5446, longitude: 127.0557 },
  홍대: { latitude: 37.5563, longitude: 126.9236 },
  강남: { latitude: 37.4979, longitude: 127.0276 },
  을지로: { latitude: 37.5663, longitude: 126.9911 },
};

class MockTransitProvider implements TransitProvider {
  label = "Mock transit";
  isLive = false;

  async applyTravelTimes(_origin: { latitude: number; longitude: number }, candidates: VenueCandidate[]) {
    return candidates;
  }
}

class OdsayTransitProvider implements TransitProvider {
  label = "ODsay transit";
  isLive = true;

  constructor(private readonly apiKey: string) {}

  async applyTravelTimes(origin: { latitude: number; longitude: number }, candidates: VenueCandidate[]) {
    const nextCandidates = await Promise.all(
      candidates.map(async (candidate) => {
        const searchParams = new URLSearchParams({
          SX: String(origin.longitude),
          SY: String(origin.latitude),
          EX: String(candidate.longitude),
          EY: String(candidate.latitude),
          apiKey: this.apiKey,
        });

        const response = await fetch(
          `https://api.odsay.com/v1/api/searchPubTransPathT?${searchParams.toString()}`,
          { cache: "no-store" }
        );

        if (!response.ok) {
          return candidate;
        }

        const payload = (await response.json()) as {
          result?: {
            path?: Array<{
              info?: {
                totalTime?: number;
              };
            }>;
          };
        };

        const totalTime = payload.result?.path?.[0]?.info?.totalTime;

        if (!totalTime) {
          return candidate;
        }

        return {
          ...candidate,
          transitMode: totalTime <= 8 ? "walk" : candidate.transitMode,
          travelMinutes: totalTime,
        };
      })
    );

    return nextCandidates;
  }
}

export function getOriginPoint(district: string) {
  return fallbackDistrictCenters[district] ?? fallbackDistrictCenters.성수;
}

export function resolveTransitProvider() {
  const apiKey = process.env.ODSAY_API_KEY;

  if (apiKey) {
    return new OdsayTransitProvider(apiKey);
  }

  return new MockTransitProvider();
}

export function getTransitProviderDiagnostics() {
  return getRuntimeDiagnostics().transit;
}

export function buildTransitFallbackStatus(message: string): ProviderStatus {
  return {
    stage: "transit",
    activeProvider: "Mock transit",
    mode: "fallback",
    message,
  };
}
