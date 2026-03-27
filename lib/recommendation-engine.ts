import { createCacheKey, getCachedValue, setCachedValue } from "@/lib/cache-store";
import {
  buildPlaceFallbackStatus,
  getPlaceProviderDiagnostics,
  resolvePlaceSearchProvider,
  resolveOriginPoint,
} from "@/lib/providers/place-search";
import {
  buildTransitFallbackStatus,
  getTransitProviderDiagnostics,
  resolveTransitProvider,
} from "@/lib/providers/transit";
import {
  getReviewProviderDiagnostics,
  resolveReviewProvider,
} from "@/lib/review-provider";
import { venueCandidates } from "@/lib/recommendation-data";
import { getRuntimeDiagnostics } from "@/lib/runtime-config";
import type {
  RecommendationAlert,
  RecommendationAlternative,
  ProviderDiagnostics,
  ProviderStatus,
  RecommendationRequest,
  RecommendationResponse,
  RecommendationTimeSummary,
  UserPreferences,
  VenueCandidate,
} from "@/lib/types";

function getQuietBonus(candidate: VenueCandidate, preferences: UserPreferences) {
  if (preferences.vibePreference !== "quiet") {
    return 0;
  }

  return candidate.quietScore * 2;
}

function getVisualBonus(candidate: VenueCandidate, preferences: UserPreferences) {
  if (preferences.vibePreference !== "cinematic") {
    return 0;
  }

  return candidate.visualScore * 2;
}

function getIndoorBonus(candidate: VenueCandidate, preferences: UserPreferences) {
  return preferences.indoorPriority && candidate.indoor ? 8 : 0;
}

function getWalkPenalty(candidate: VenueCandidate, preferences: UserPreferences) {
  if (preferences.walkPreference === "adventurous") {
    return 0;
  }

  if (preferences.walkPreference === "balanced") {
    return candidate.transitMode === "walk" && candidate.travelMinutes > 6 ? 5 : 0;
  }

  return candidate.transitMode === "walk" ? candidate.travelMinutes : 0;
}

function getBudgetPenalty(candidate: VenueCandidate, preferences: UserPreferences, categoryCount: number) {
  const idealPerStop = Math.floor(preferences.budgetCap / Math.max(categoryCount, 1));
  return candidate.estimatedCost > idealPerStop ? Math.floor((candidate.estimatedCost - idealPerStop) / 1500) : 0;
}

function getNoveltyBonus(candidate: VenueCandidate, recentlyVisitedIds: string[]) {
  if (!recentlyVisitedIds.length) return 0;
  return recentlyVisitedIds.includes(candidate.id) ? -15 : 5;
}

function scoreCandidate(
  candidate: VenueCandidate,
  preferences: UserPreferences,
  categoryCount: number,
  recentlyVisitedIds: string[] = []
) {
  return (
    100 +
    getQuietBonus(candidate, preferences) +
    getVisualBonus(candidate, preferences) +
    getIndoorBonus(candidate, preferences) -
    getWalkPenalty(candidate, preferences) -
    getBudgetPenalty(candidate, preferences, categoryCount) +
    getNoveltyBonus(candidate, recentlyVisitedIds)
  );
}

function getCurrentSeoulMinutes() {
  const formatter = new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Seoul",
  });
  const parts = formatter.formatToParts(new Date());
  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? "0");
  const minute = Number(parts.find((part) => part.type === "minute")?.value ?? "0");

  return hour * 60 + minute;
}

function formatClock(totalMinutes: number) {
  const normalized = ((totalMinutes % (24 * 60)) + 24 * 60) % (24 * 60);
  const hour = Math.floor(normalized / 60)
    .toString()
    .padStart(2, "0");
  const minute = (normalized % 60).toString().padStart(2, "0");

  return `${hour}:${minute}`;
}

function getCrowdProfile(candidate: VenueCandidate, arrivalMinutes: number) {
  const hour = Math.floor((((arrivalMinutes % (24 * 60)) + 24 * 60) % (24 * 60)) / 60);

  switch (candidate.category) {
    case "movie":
      if (hour >= 18 && hour <= 21) {
        return { crowdLevel: "high" as const, estimatedWaitMinutes: 12, crowdLabel: "붐빔", note: "저녁 피크 시간대라 매표/입장 동선이 답답할 수 있습니다." };
      }
      if ((hour >= 14 && hour < 18) || hour === 22) {
        return { crowdLevel: "medium" as const, estimatedWaitMinutes: 6, crowdLabel: "보통", note: "조금 일찍 도착하면 흐름이 매끈합니다." };
      }
      return { crowdLevel: "low" as const, estimatedWaitMinutes: 2, crowdLabel: "여유", note: "비교적 편하게 입장 가능한 시간대입니다." };
    case "cafe":
      if (hour >= 13 && hour <= 17) {
        return { crowdLevel: "high" as const, estimatedWaitMinutes: 14, crowdLabel: "붐빔", note: "디저트 피크 시간대라 좌석 대기가 생길 수 있습니다." };
      }
      if ((hour >= 11 && hour < 13) || (hour >= 18 && hour <= 20)) {
        return { crowdLevel: "medium" as const, estimatedWaitMinutes: 7, crowdLabel: "보통", note: "주문은 빠르지만 자리 선택 폭은 줄어들 수 있습니다." };
      }
      return { crowdLevel: "low" as const, estimatedWaitMinutes: 3, crowdLabel: "여유", note: "카페 대기 부담이 크지 않은 시간대입니다." };
    case "dinner":
      if (hour >= 18 && hour <= 20) {
        return { crowdLevel: "high" as const, estimatedWaitMinutes: 22, crowdLabel: "붐빔", note: "저녁 메인 타임이라 웨이팅이나 음식 지연을 감안하는 편이 안전합니다." };
      }
      if ((hour >= 12 && hour <= 13) || hour === 17 || hour === 21) {
        return { crowdLevel: "medium" as const, estimatedWaitMinutes: 10, crowdLabel: "보통", note: "타이밍은 괜찮지만 주문 몰림이 있을 수 있습니다." };
      }
      return { crowdLevel: "low" as const, estimatedWaitMinutes: 4, crowdLabel: "여유", note: "식사 흐름이 비교적 안정적입니다." };
    case "bar":
      if (hour >= 20 && hour <= 23) {
        return { crowdLevel: "high" as const, estimatedWaitMinutes: 10, crowdLabel: "붐빔", note: "인기 시간대라 자리 선점이 중요합니다." };
      }
      if (hour >= 18 && hour < 20) {
        return { crowdLevel: "medium" as const, estimatedWaitMinutes: 5, crowdLabel: "보통", note: "초반 입장은 무난하지만 늦어지면 급격히 붐빌 수 있습니다." };
      }
      return { crowdLevel: "low" as const, estimatedWaitMinutes: 2, crowdLabel: "여유", note: "바로 착석할 가능성이 높습니다." };
    case "gallery":
      if (hour >= 13 && hour <= 16) {
        return { crowdLevel: "medium" as const, estimatedWaitMinutes: 5, crowdLabel: "보통", note: "전시 피크가 시작되는 시간이라 동선이 조금 느려질 수 있습니다." };
      }
      return { crowdLevel: "low" as const, estimatedWaitMinutes: 1, crowdLabel: "여유", note: "조용하게 보기 좋은 시간대입니다." };
    case "walk":
      if (hour >= 19 && hour <= 21) {
        return { crowdLevel: "medium" as const, estimatedWaitMinutes: 0, crowdLabel: "보통", note: "보행량은 늘지만 대화 흐름은 유지하기 괜찮습니다." };
      }
      return { crowdLevel: "low" as const, estimatedWaitMinutes: 0, crowdLabel: "여유", note: "정리용 산책으로 쓰기 좋은 타이밍입니다." };
    default:
      return { crowdLevel: "low" as const, estimatedWaitMinutes: 0, crowdLabel: "여유", note: "비교적 안정적인 시간대입니다." };
  }
}

function attachTimingContext(candidates: VenueCandidate[]) {
  const startMinutes = getCurrentSeoulMinutes();
  let cursor = startMinutes;

  const enrichedCandidates = candidates.map((candidate) => {
    cursor += candidate.travelMinutes;
    const timing = getCrowdProfile(candidate, cursor);
    const nextCandidate = {
      ...candidate,
      timing: {
        arrivalLabel: `${formatClock(cursor)} 도착 예상`,
        crowdLevel: timing.crowdLevel,
        crowdLabel: timing.crowdLabel,
        estimatedWaitMinutes: timing.estimatedWaitMinutes,
        note: timing.note,
      },
    };
    cursor += candidate.stayMinutes + timing.estimatedWaitMinutes;
    return nextCandidate;
  });

  const hasPeakRisk = enrichedCandidates.some(
    (candidate) => candidate.timing?.crowdLevel === "high" || (candidate.timing?.estimatedWaitMinutes ?? 0) >= 15
  );

  const timeSummary: RecommendationTimeSummary = {
    startLabel: `현재 기준 ${formatClock(startMinutes)} 출발`,
    peakRiskLabel: hasPeakRisk ? "피크 시간대 포함" : "시간대 흐름 안정",
    peakRiskTone: hasPeakRisk ? "caution" : "good",
  };

  return { enrichedCandidates, timeSummary };
}

function buildFirstDateTips(candidate: VenueCandidate): string[] {
  const tips: string[] = [];
  if (candidate.quietScore >= 4) tips.push("조용해서 대화에 집중하기 좋아요");
  if (candidate.indoor) tips.push("날씨 걱정 없이 편안하게");
  if (candidate.stayMinutes >= 90) tips.push("충분한 시간 여유로 자연스러운 대화");
  if (candidate.stayMinutes <= 60) tips.push("부담 없는 짧은 체류로 어색함 최소화");
  if (candidate.estimatedCost <= 15000) tips.push("부담 없는 가격대");
  if (candidate.visualScore >= 4) tips.push("사진 포인트로 어색한 순간을 자연스럽게");
  if (candidate.tags?.includes("소개팅")) tips.push("소개팅 장소로 검증됨");
  if (candidate.tags?.includes("넓은 좌석")) tips.push("옆 테이블과 거리감 있어 대화에 집중");
  return tips.slice(0, 3);
}

function buildFitBadges(
  candidate: VenueCandidate,
  preferences: UserPreferences,
  categoryCount: number
) {
  const badges: VenueCandidate["fitBadges"] = [];
  const idealPerStop = Math.floor(preferences.budgetCap / Math.max(categoryCount, 1));

  if (candidate.estimatedCost === 0 || candidate.estimatedCost <= idealPerStop) {
    badges.push({ label: "예산 무난", tone: "good" });
  } else if (candidate.estimatedCost - idealPerStop >= 6000) {
    badges.push({ label: "예산 압박", tone: "caution" });
  } else {
    badges.push({ label: "예산 타이트", tone: "neutral" });
  }

  if (candidate.travelMinutes <= 4) {
    badges.push({ label: "이동 가벼움", tone: "good" });
  } else if (
    preferences.walkPreference === "easy" &&
    candidate.transitMode === "walk" &&
    candidate.travelMinutes >= 7
  ) {
    badges.push({ label: "도보 부담", tone: "caution" });
  } else if (candidate.travelMinutes >= 10) {
    badges.push({ label: "이동 길이 있음", tone: "neutral" });
  }

  if (preferences.indoorPriority) {
    badges.push({
      label: candidate.indoor ? "실내 선호 일치" : "실내 선호와 다름",
      tone: candidate.indoor ? "good" : "caution",
    });
  }

  if (preferences.vibePreference === "quiet" && candidate.quietScore >= 4) {
    badges.push({ label: "대화 안정", tone: "good" });
  } else if (preferences.vibePreference === "cinematic" && candidate.visualScore >= 4) {
    badges.push({ label: "무드 강점", tone: "good" });
  }

  return badges.slice(0, 4);
}

function shouldSuggestAlternative(candidate: VenueCandidate, preferences: UserPreferences, categoryCount: number) {
  const idealPerStop = Math.floor(preferences.budgetCap / Math.max(categoryCount, 1));

  return (
    (candidate.timing?.crowdLevel === "high" || (candidate.timing?.estimatedWaitMinutes ?? 0) >= 12) ||
    candidate.estimatedCost - idealPerStop >= 6000 ||
    (preferences.walkPreference === "easy" &&
      candidate.transitMode === "walk" &&
      candidate.travelMinutes >= 7) ||
    (preferences.indoorPriority && !candidate.indoor)
  );
}

function buildAlternativeSuggestion(
  candidate: VenueCandidate,
  candidatePool: VenueCandidate[],
  preferences: UserPreferences,
  categoryCount: number
): RecommendationAlternative | undefined {
  if (!shouldSuggestAlternative(candidate, preferences, categoryCount)) {
    return undefined;
  }

  const alternatives = candidatePool
    .filter(
      (option) =>
        option.id !== candidate.id &&
        option.category === candidate.category &&
        option.district === candidate.district
    )
    .map((option) => ({
      option,
      score:
        scoreCandidate(option, preferences, categoryCount) -
        Math.abs(option.quietScore - candidate.quietScore) -
        Math.abs(option.visualScore - candidate.visualScore) -
        Math.floor(Math.abs(option.estimatedCost - candidate.estimatedCost) / 4000),
    }))
    .sort((left, right) => right.score - left.score)[0]?.option;

  if (!alternatives) {
    return undefined;
  }

  const reasons: string[] = [];

  if ((candidate.timing?.estimatedWaitMinutes ?? 0) > 0) {
    reasons.push("혼잡도를 줄이기 쉬움");
  }
  if (alternatives.estimatedCost < candidate.estimatedCost) {
    reasons.push("예산 부담 완화");
  }
  if (alternatives.travelMinutes < candidate.travelMinutes) {
    reasons.push("이동 피로 감소");
  }
  if (preferences.indoorPriority && alternatives.indoor && !candidate.indoor) {
    reasons.push("실내 선호 일치");
  }

  const reason = reasons[0] ?? "비슷한 분위기를 유지하면서 운영이 더 안정적";

  return {
    candidateId: alternatives.id,
    name: alternatives.name,
    detail: `${alternatives.transitMode === "walk" ? "도보" : alternatives.transitMode === "subway" ? "지하철" : alternatives.transitMode === "bus" ? "버스" : "택시"} ${alternatives.travelMinutes}분 · ${alternatives.estimatedCost.toLocaleString("ko-KR")}원`,
    reason,
  };
}

function buildRouteAlerts(
  candidates: VenueCandidate[],
  preferences: UserPreferences,
  totalTravelMinutes: number,
  totalEstimatedCost: number
): RecommendationAlert[] {
  const alerts: RecommendationAlert[] = [];

  if (totalEstimatedCost > preferences.budgetCap) {
    alerts.push({
      id: "budget-over",
      title: "예산 초과 가능성",
      detail: `현재 조합은 예산 캡보다 ${(
        totalEstimatedCost - preferences.budgetCap
      ).toLocaleString("ko-KR")}원 높습니다.`,
      tone: "caution",
    });
  } else if (totalEstimatedCost >= preferences.budgetCap * 0.85) {
    alerts.push({
      id: "budget-tight",
      title: "예산이 타이트합니다",
      detail: "추가 주문이나 택시 이동이 생기면 체감 예산이 빠르게 올라갈 수 있습니다.",
      tone: "caution",
    });
  } else {
    alerts.push({
      id: "budget-safe",
      title: "예산 여유가 있습니다",
      detail: "디저트 추가나 대안 교체가 생겨도 비교적 안정적인 범위입니다.",
      tone: "good",
    });
  }

  const walkHeavyCount = candidates.filter(
    (candidate) =>
      candidate.transitMode === "walk" &&
      candidate.travelMinutes >= (preferences.walkPreference === "easy" ? 7 : 10)
  ).length;

  if (walkHeavyCount > 0 || totalTravelMinutes >= 24) {
    alerts.push({
      id: "mobility-caution",
      title: "이동 피로 체크 필요",
      detail:
        preferences.walkPreference === "easy"
          ? "도보 구간이 길게 느껴질 수 있어 카페나 식사 대안을 바꾸는 편이 안전합니다."
          : "전체 이동 시간은 감당 가능하지만 현장 지연이 생기면 후반부 피로도가 올라갈 수 있습니다.",
      tone: "caution",
    });
  } else {
    alerts.push({
      id: "mobility-good",
      title: "이동 흐름이 안정적입니다",
      detail: "환승이나 긴 도보 없이 비교적 매끈하게 이어질 수 있는 조합입니다.",
      tone: "good",
    });
  }

  const lowConfidenceCount = candidates.filter(
    (candidate) => candidate.reviewSummary?.confidence === "low"
  ).length;

  if (lowConfidenceCount > 0) {
    alerts.push({
      id: "review-confidence",
      title: "리뷰 신뢰도는 아직 낮습니다",
      detail: "현재 응답에는 목업 또는 저신뢰 리뷰 요약이 포함되어 있어 실데이터 연결 전까지는 참고용으로 보는 편이 좋습니다.",
      tone: "caution",
    });
  }

  if (preferences.indoorPriority && candidates.some((candidate) => !candidate.indoor)) {
    alerts.push({
      id: "indoor-mismatch",
      title: "실내 우선 조건과 일부 다릅니다",
      detail: "야외 성격이 있는 코스가 섞여 있어 날씨나 대기 상황에 따라 교체가 필요할 수 있습니다.",
      tone: "caution",
    });
  }

  const waitHeavyCandidate = candidates.find(
    (candidate) => (candidate.timing?.estimatedWaitMinutes ?? 0) >= 15 || candidate.timing?.crowdLevel === "high"
  );

  if (waitHeavyCandidate) {
    alerts.push({
      id: "timing-peak",
      title: "혼잡 시간대가 포함됩니다",
      detail: `${waitHeavyCandidate.name}은 ${waitHeavyCandidate.timing?.arrivalLabel} 기준 ${waitHeavyCandidate.timing?.crowdLabel} 상태로 예상됩니다.`,
      tone: "caution",
    });
  }

  return alerts.slice(0, 4);
}

export async function getRecommendation(input: RecommendationRequest): Promise<RecommendationResponse> {
  const cacheKey = createCacheKey(["recommendation", input]);
  const cached = await getCachedValue<RecommendationResponse>(cacheKey);

  if (cached.hit && cached.value) {
    return {
      ...cached.value,
      cache: {
        hit: true,
        source: cached.source,
        key: cacheKey,
        ttlSeconds: 900,
      },
    };
  }

  const placeProvider = resolvePlaceSearchProvider();
  const transitProvider = resolveTransitProvider();
  const reviewProvider = resolveReviewProvider();
  const providerStatuses: ProviderStatus[] = [];

  // place search와 origin geocoding은 독립적이므로 병렬 실행
  const [placesSettled, resolvedOrigin] = await Promise.all([
    placeProvider.search(input).then(
      (result) => ({ ok: true as const, value: result }),
      () => ({ ok: false as const })
    ),
    resolveOriginPoint(input.originLabel, input.district),
  ]);

  let candidates: VenueCandidate[];
  if (placesSettled.ok) {
    candidates = placesSettled.value;
    const hasPlaceFallback = placeProvider.isLive && candidates.some((candidate) => candidate.source === "mock");
    providerStatuses.push({
      stage: "place",
      activeProvider: placeProvider.label,
      mode: hasPlaceFallback ? "fallback" : placeProvider.isLive ? "live" : "mock",
      message: hasPlaceFallback
        ? "장소 검색은 실데이터를 우선 사용했지만 일부 카테고리는 목업 후보로 fallback했습니다."
        : placeProvider.isLive
          ? "장소 검색에 실데이터 provider를 사용했습니다."
        : "장소 검색은 현재 목업 provider를 사용 중입니다.",
    });
  } else {
    candidates = input.categories
      .map((category) =>
        venueCandidates.find(
          (candidate) => candidate.category === category && candidate.district === input.district
        )
      )
      .filter((candidate): candidate is VenueCandidate => Boolean(candidate));
    providerStatuses.push(buildPlaceFallbackStatus("장소 검색 provider 호출에 실패해 목업 후보로 fallback했습니다."));
  }

  let withTransit: VenueCandidate[];
  try {
    withTransit = await transitProvider.applyTravelTimes(resolvedOrigin, candidates);
    providerStatuses.push({
      stage: "transit",
      activeProvider: transitProvider.label,
      mode: transitProvider.isLive ? "live" : "mock",
      message: transitProvider.isLive
        ? "이동 시간 계산에 실데이터 transit provider를 사용했습니다."
        : "이동 시간 계산은 현재 목업 provider를 사용 중입니다.",
    });
  } catch {
    withTransit = candidates;
    providerStatuses.push(buildTransitFallbackStatus("대중교통 계산 provider 호출에 실패해 기존 이동 시간을 유지했습니다."));
  }

  const categoryCount = input.categories.length;
  const orderedCandidates = input.categories
    .map((category) => {
      const selectedCandidate = input.selectedCandidateIds?.length
        ? withTransit.find(
            (candidate) =>
              candidate.category === category && input.selectedCandidateIds?.includes(candidate.id)
          )
        : undefined;

      if (selectedCandidate) {
        return selectedCandidate;
      }

      return [...withTransit]
        .filter((candidate) => candidate.category === category)
        .sort(
          (left, right) =>
            scoreCandidate(right, input.preferences, categoryCount, input.recentlyVisitedIds) -
            scoreCandidate(left, input.preferences, categoryCount, input.recentlyVisitedIds)
        )[0];
    })
    .filter((candidate): candidate is VenueCandidate => Boolean(candidate));
  const reviewResults = await Promise.all(
    orderedCandidates.map(async (candidate) => {
      const result = await reviewProvider.summarize(candidate);
      const fitBadges = buildFitBadges(candidate, input.preferences, categoryCount);

      if (result.summary.confidence === "high") {
        fitBadges.push({ label: "리뷰 신뢰 높음", tone: "good" });
      } else if (result.summary.confidence === "medium") {
        fitBadges.push({ label: "리뷰 보통", tone: "neutral" });
      } else {
        fitBadges.push({ label: "리뷰 참고용", tone: "caution" });
      }

      return {
        candidate: {
          ...candidate,
          fitBadges: fitBadges.slice(0, 4),
          reviewSummary: result.summary,
        },
        status: result.status,
      };
    })
  );
  const candidatesWithReviews = reviewResults.map((entry) => entry.candidate);
  const { enrichedCandidates, timeSummary } = attachTimingContext(candidatesWithReviews);
  const candidatesWithAlternatives = enrichedCandidates.map((candidate) => ({
    ...candidate,
    alternativeSuggestion: buildAlternativeSuggestion(
      candidate,
      withTransit,
      input.preferences,
      categoryCount
    ),
    firstDateTips: buildFirstDateTips(candidate),
  }));
  const reviewStatus = reviewResults[0]?.status;
  if (reviewStatus) {
    providerStatuses.push(reviewStatus);
  }

  const totalTravelMinutes = candidatesWithAlternatives.reduce((sum, candidate) => sum + candidate.travelMinutes, 0);
  const totalEstimatedCost = candidatesWithAlternatives.reduce((sum, candidate) => sum + candidate.estimatedCost, 0);
  const usesRealData = candidatesWithAlternatives.some((candidate) => candidate.source === "kakao");
  const allPlacesRealData =
    candidatesWithAlternatives.length > 0 &&
    candidatesWithAlternatives.every((candidate) => candidate.source === "kakao");
  const alerts = buildRouteAlerts(
    candidatesWithAlternatives,
    input.preferences,
    totalTravelMinutes,
    totalEstimatedCost
  );
  if (placeProvider.isLive && !allPlacesRealData) {
    alerts.unshift({
      id: "place-partial-fallback",
      title: "장소 데이터가 일부 fallback 상태입니다",
      detail: "실데이터 검색 결과가 충분하지 않은 카테고리는 목업 후보가 섞여 있을 수 있습니다.",
      tone: "caution",
    });
  }

  const result: RecommendationResponse = {
    provider: allPlacesRealData ? "live" : usesRealData ? "hybrid" : "mock",
    providerLabel: `${placeProvider.label} + ${transitProvider.label} + ${reviewProvider.label}`,
    providers: providerStatuses,
    routeLabel: `${input.district} ${input.categories.join(" · ")} 코스`,
    timeSummary,
    totalTravelMinutes,
    totalEstimatedCost,
    explanation: `${input.originLabel} 기준 ${input.district}에서 ${input.categories.length}개 활동을 연결했습니다. ${
      input.preferences.walkPreference === "easy"
        ? "도보 스트레스를 줄였고"
        : input.preferences.walkPreference === "balanced"
          ? "이동과 무드 균형을 맞췄고"
          : "이동 가능 범위를 넓혀 선택지를 확보했고"
    } ${
      input.preferences.vibePreference === "quiet"
        ? "조용한 장소 점수를 높게 봤습니다."
        : input.preferences.vibePreference === "cinematic"
          ? "시각적 무드와 사진 포인트를 높게 봤습니다."
          : "가볍게 템포가 바뀌는 장소를 우선했습니다."
    }`,
    alerts: alerts.slice(0, 4),
    candidates: candidatesWithAlternatives,
    cache: {
      hit: false,
      source: "none",
      key: cacheKey,
      ttlSeconds: 900,
    },
  };

  await setCachedValue(cacheKey, result, 900);

  return result;
}

export function getProviderDiagnostics(): ProviderDiagnostics {
  const runtimeDiagnostics = getRuntimeDiagnostics();

  return {
    readyForLive: runtimeDiagnostics.readyForLive,
    place: getPlaceProviderDiagnostics(),
    transit: getTransitProviderDiagnostics(),
    review: getReviewProviderDiagnostics(),
    setupSteps: runtimeDiagnostics.setupSteps,
    issues: runtimeDiagnostics.issues,
  };
}
