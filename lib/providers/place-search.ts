import { venueCandidates } from "@/lib/recommendation-data";
import type { ActivityCategory, ProviderStatus, RecommendationRequest, VenueCandidate } from "@/lib/types";
import { getRuntimeDiagnostics } from "@/lib/runtime-config";

const districtCenters: Record<string, { latitude: number; longitude: number }> = {
  성수: { latitude: 37.5446, longitude: 127.0557 },
  홍대: { latitude: 37.5563, longitude: 126.9236 },
  강남: { latitude: 37.4979, longitude: 127.0276 },
  을지로: { latitude: 37.5663, longitude: 126.9911 },
};

const categoryQueryMap: Record<ActivityCategory, string> = {
  movie: "영화관",
  cafe: "카페",
  dinner: "식당",
  bar: "바",
  gallery: "전시",
  walk: "산책",
};

const maxDistanceByCategory: Record<ActivityCategory, number> = {
  movie: 3000,
  cafe: 1800,
  dinner: 2200,
  bar: 2200,
  gallery: 2600,
  walk: 1400,
};

const blockedKeywordMap: Record<ActivityCategory, string[]> = {
  movie: ["노래방", "오락실", "PC방", "당구", "볼링"],
  cafe: ["편의점", "주유소", "셀프", "스터디카페", "만화카페"],
  dinner: ["편의점", "마트", "백화점", "푸드코트", "구내식당"],
  bar: ["편의점", "포차거리", "노래방", "클럽"],
  gallery: ["카페", "식당", "호텔", "웨딩", "학원"],
  walk: ["호텔", "주차장", "아파트", "오피스텔"],
};

const softBlockedChains = ["스타벅스", "투썸", "메가커피", "컴포즈", "빽다방"];

type KakaoDocument = {
  id: string;
  place_name: string;
  address_name: string;
  category_name: string;
  x: string;
  y: string;
  distance?: string;
};

function getEstimatedCost(category: ActivityCategory) {
  switch (category) {
    case "movie":
      return 24000;
    case "dinner":
      return 28000;
    case "bar":
      return 18000;
    case "gallery":
      return 22000;
    case "walk":
      return 0;
    default:
      return 18000;
  }
}

function getStayMinutes(category: ActivityCategory) {
  switch (category) {
    case "movie":
      return 120;
    case "dinner":
      return 75;
    case "bar":
      return 55;
    case "gallery":
      return 65;
    case "walk":
      return 30;
    default:
      return 60;
  }
}

function getTransitModeByDistance(distance: number): VenueCandidate["transitMode"] {
  if (distance <= 700) {
    return "walk";
  }
  if (distance <= 1800) {
    return "subway";
  }
  return "bus";
}

function buildKakaoCandidate(params: {
  category: ActivityCategory;
  district: string;
  document: KakaoDocument;
  index: number;
}) {
  const distance = Number(params.document.distance ?? "800");
  const travelMinutes = Math.max(4, Math.round(distance / 85));
  const tailCategory = params.document.category_name.split(">").at(-1)?.trim() ?? categoryQueryMap[params.category];

  return {
    id: `kakao-${params.document.id}-${params.index}`,
    name: params.document.place_name,
    category: params.category,
    district: params.district,
    concept: params.document.category_name,
    description: `${params.document.address_name} 기준으로 찾은 ${categoryQueryMap[params.category]} 후보`,
    transitMode: getTransitModeByDistance(distance),
    travelMinutes,
    stayMinutes: getStayMinutes(params.category),
    estimatedCost: getEstimatedCost(params.category),
    quietScore: params.category === "cafe" ? 4 : params.category === "dinner" ? 4 : 3,
    visualScore: params.category === "gallery" ? 5 : params.category === "bar" ? 4 : 3,
    indoor: params.category !== "walk",
    latitude: Number(params.document.y),
    longitude: Number(params.document.x),
    source: "kakao",
    tags: [tailCategory, "실데이터"],
  } satisfies VenueCandidate;
}

function normalizePlaceName(name: string) {
  return name.replace(/\s+/g, "").toLowerCase();
}

function isBlockedDocument(category: ActivityCategory, document: KakaoDocument) {
  const haystack = `${document.place_name} ${document.category_name} ${document.address_name}`.toLowerCase();
  return blockedKeywordMap[category].some((keyword) => haystack.includes(keyword.toLowerCase()));
}

function isSoftBlockedChain(category: ActivityCategory, document: KakaoDocument) {
  if (category !== "cafe") {
    return false;
  }

  return softBlockedChains.some((keyword) => document.place_name.includes(keyword));
}

function documentQualityScore(category: ActivityCategory, document: KakaoDocument) {
  const distance = Number(document.distance ?? "900");
  const categoryLabel = document.category_name.toLowerCase();
  let score = 100 - Math.floor(distance / 90);

  if (category === "gallery" && categoryLabel.includes("전시")) {
    score += 12;
  }
  if (category === "movie" && categoryLabel.includes("영화")) {
    score += 10;
  }
  if ((category === "cafe" || category === "dinner" || category === "bar") && categoryLabel.includes("음식점")) {
    score += 6;
  }
  if (isSoftBlockedChain(category, document)) {
    score -= 18;
  }

  return score;
}

function filterKakaoDocuments(category: ActivityCategory, documents: KakaoDocument[]) {
  const seen = new Set<string>();

  const filtered = documents
    .filter((document) => {
      const distance = Number(document.distance ?? "900");

      if (distance > maxDistanceByCategory[category]) {
        return false;
      }
      if (isBlockedDocument(category, document)) {
        return false;
      }

      const normalizedName = normalizePlaceName(document.place_name);
      if (seen.has(normalizedName)) {
        return false;
      }
      seen.add(normalizedName);
      return true;
    })
    .sort((left, right) => documentQualityScore(category, right) - documentQualityScore(category, left));

  return filtered;
}

function getMockFallbackCandidates(request: RecommendationRequest, category: ActivityCategory) {
  return venueCandidates
    .filter((candidate) => candidate.district === request.district && candidate.category === category)
    .slice(0, 2);
}

export type PlaceSearchProvider = {
  label: string;
  isLive: boolean;
  search(request: RecommendationRequest): Promise<VenueCandidate[]>;
};

class MockPlaceSearchProvider implements PlaceSearchProvider {
  label = "Mock places";
  isLive = false;

  async search(request: RecommendationRequest) {
    return venueCandidates.filter(
      (candidate) =>
        candidate.district === request.district && request.categories.includes(candidate.category)
    );
  }
}

class KakaoPlaceSearchProvider implements PlaceSearchProvider {
  label = "Kakao Local";
  isLive = true;

  constructor(private readonly apiKey: string) {}

  async search(request: RecommendationRequest): Promise<VenueCandidate[]> {
    const districtCenter = districtCenters[request.district];

    const responses = await Promise.all(
      request.categories.map(async (category) => {
        const query = `${request.district} ${categoryQueryMap[category]}`;
        const searchParams = new URLSearchParams({
          query,
          size: "6",
        });

        if (districtCenter) {
          searchParams.set("x", String(districtCenter.longitude));
          searchParams.set("y", String(districtCenter.latitude));
          searchParams.set("radius", "2500");
        }

        const response = await fetch(
          `https://dapi.kakao.com/v2/local/search/keyword.json?${searchParams.toString()}`,
          {
            headers: {
              Authorization: `KakaoAK ${this.apiKey}`,
            },
            cache: "no-store",
          }
        );

        if (!response.ok) {
          throw new Error("kakao_place_search_failed");
        }

        const payload = (await response.json()) as {
          documents?: KakaoDocument[];
        };

        if (!payload.documents?.length) {
          return getMockFallbackCandidates(request, category);
        }

        const filteredDocuments = filterKakaoDocuments(category, payload.documents);
        const sourceDocuments = filteredDocuments.length > 0 ? filteredDocuments : payload.documents;

        const mappedCandidates = sourceDocuments
          .slice(0, 3)
          .map((document, index) =>
            buildKakaoCandidate({
              category,
              district: request.district,
              document,
              index,
            })
          );

        return mappedCandidates.length > 0
          ? mappedCandidates
          : getMockFallbackCandidates(request, category);
      })
    );

    return responses.flat();
  }
}

export function resolvePlaceSearchProvider() {
  const apiKey = process.env.KAKAO_REST_API_KEY;

  if (apiKey) {
    return new KakaoPlaceSearchProvider(apiKey);
  }

  return new MockPlaceSearchProvider();
}

export function getPlaceProviderDiagnostics() {
  return getRuntimeDiagnostics().place;
}

export function buildPlaceFallbackStatus(message: string): ProviderStatus {
  return {
    stage: "place",
    activeProvider: "Mock places",
    mode: "fallback",
    message,
  };
}
