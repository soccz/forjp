import { scenarioSummaries, scenarios } from "@/lib/planner-data";
import type {
  ActivityCategory,
  PlannerAltPanel,
  PlannerMode,
  PlannerResult,
  PlannerScores,
  PlannerStep,
  RecommendationResponse,
  ScenarioId,
  ScenarioSummary,
  UserPreferences,
} from "@/lib/types";

export const defaultPreferences: UserPreferences = {
  budgetCap: 80000,
  walkPreference: "balanced",
  vibePreference: "quiet",
  indoorPriority: false,
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function formatCurrency(value: number) {
  return `${value.toLocaleString("ko-KR")}원`;
}

function formatMinutes(value: number) {
  const hours = Math.floor(value / 60);
  const minutes = value % 60;

  if (hours === 0) {
    return `${minutes}분`;
  }

  return `${hours}시간 ${minutes}분`;
}

function reorderSteps(steps: PlannerStep[], stepIds?: string[]) {
  if (!stepIds || stepIds.length !== steps.length) {
    return steps;
  }

  const stepMap = new Map(steps.map((step) => [step.id, step]));
  const orderedSteps = stepIds
    .map((stepId) => stepMap.get(stepId))
    .filter((step): step is PlannerStep => Boolean(step));

  return orderedSteps.length === steps.length ? orderedSteps : steps;
}

function replaceAlternative(scenarioId: ScenarioId, steps: PlannerStep[]) {
  const alt = scenarios[scenarioId].altPanel;
  const stepIndex = steps.findIndex((step) => step.id === alt.stepId);

  if (stepIndex === -1) {
    return steps;
  }

  const nextSteps = [...steps];
  const targetStep = nextSteps[stepIndex];
  nextSteps[stepIndex] = {
    ...targetStep,
    title: alt.candidate.title,
    description: alt.candidate.description,
    transferLabel: alt.candidate.transferLabel,
    transferMinutes: alt.candidate.transferMinutes,
    priceValue: alt.candidate.priceValue,
    priceLabel: formatCurrency(alt.candidate.priceValue),
    trustScore: alt.candidate.trustScore,
    walkIntensity: alt.candidate.walkIntensity,
    tags: alt.candidate.tags,
  };

  return nextSteps;
}

function normalizePreferences(preferences?: Partial<UserPreferences>): UserPreferences {
  return {
    budgetCap: preferences?.budgetCap ?? defaultPreferences.budgetCap,
    walkPreference: preferences?.walkPreference ?? defaultPreferences.walkPreference,
    vibePreference: preferences?.vibePreference ?? defaultPreferences.vibePreference,
    indoorPriority: preferences?.indoorPriority ?? defaultPreferences.indoorPriority,
  };
}

function computeScoresForBaseMood(
  baseMood: number,
  steps: PlannerStep[],
  totalCost: number,
  preferences: UserPreferences
): PlannerScores {
  const transferMinutes = steps.reduce((sum, step) => sum + step.transferMinutes, 0);
  const trustAverage =
    steps.reduce((sum, step) => sum + step.trustScore, 0) / Math.max(steps.length, 1);
  const lowWalkCount = steps.filter((step) => step.walkIntensity === "low").length;
  const mediumWalkCount = steps.filter((step) => step.walkIntensity === "medium").length;
  const taxiCount = steps.filter((step) => step.transferLabel.includes("택시")).length;
  const indoorCount = steps.filter((step) =>
    step.tags.some((tag) => ["실내", "비 회피", "지하 연결", "라운지"].includes(tag))
  ).length;
  const quietCount = steps.filter((step) =>
    step.tags.some((tag) => ["조용함", "대화 적합", "소음 낮음", "좌석 넓음"].includes(tag))
  ).length;
  const visualCount = steps.filter((step) =>
    step.tags.some((tag) => ["사진발", "사진 포인트", "야경", "채광"].includes(tag))
  ).length;

  const firstCategory = steps[0]?.category;
  const lastCategory = steps[steps.length - 1]?.category;
  const flowBonus =
    (firstCategory === "영화" || firstCategory === "카페" || firstCategory === "전시") &&
    (lastCategory === "식사" || lastCategory === "산책")
      ? 4
      : 0;

  const walkPenalty =
    preferences.walkPreference === "easy"
      ? mediumWalkCount * 3 + (steps.length - lowWalkCount - mediumWalkCount) * 6
      : preferences.walkPreference === "balanced"
        ? mediumWalkCount + (steps.length - lowWalkCount - mediumWalkCount) * 3
        : 0;
  const vibeBonus =
    preferences.vibePreference === "quiet"
      ? quietCount * 2
      : preferences.vibePreference === "cinematic"
        ? visualCount * 2
        : steps.filter((step) => step.category === "산책" || step.category === "전시").length * 2;
  const indoorBonus = preferences.indoorPriority ? indoorCount * 2 : 0;

  const mobility = clamp(96 - transferMinutes - taxiCount * 3 + lowWalkCount * 2 - walkPenalty, 70, 98);
  const budget = clamp(
    88 + Math.round(((preferences.budgetCap - totalCost) / Math.max(preferences.budgetCap, 1)) * 20),
    64,
    98
  );
  const mood = clamp(baseMood + flowBonus - taxiCount + vibeBonus + indoorBonus, 76, 98);
  const accessibility = clamp(84 + lowWalkCount * 4 - taxiCount * 2 + indoorBonus - walkPenalty, 70, 99);
  const overall = clamp(
    Math.round(mobility * 0.32 + mood * 0.28 + budget * 0.2 + accessibility * 0.2 + trustAverage * 0.08),
    72,
    98
  );

  return {
    overall,
    mobility,
    mood,
    budget,
    accessibility,
  };
}

function computeScores(
  scenarioId: ScenarioId,
  steps: PlannerStep[],
  totalCost: number,
  preferences: UserPreferences
) {
  return computeScoresForBaseMood(scenarios[scenarioId].baseMood, steps, totalCost, preferences);
}

function buildReasonFromIntro(
  mode: PlannerMode,
  steps: PlannerStep[],
  intro: string,
  preferences: UserPreferences
) {
  const first = steps[0];
  const last = steps[steps.length - 1];
  const modeCopy =
    mode === "p"
      ? "즉흥 대응이 쉬우도록 다음 단계 판단이 가벼운 순서로 정리했습니다."
      : "전체 순서를 수정해도 흐름이 크게 깨지지 않도록 편집 여지를 남겼습니다.";

  const preferenceCopy = `예산 ${formatCurrency(preferences.budgetCap)}와 ${
    preferences.walkPreference === "easy"
      ? "짧은 도보"
      : preferences.walkPreference === "balanced"
        ? "무난한 이동"
        : "조금 더 적극적인 이동"
  } 선호를 반영했고, ${
    preferences.vibePreference === "quiet"
      ? "조용한 분위기"
      : preferences.vibePreference === "cinematic"
        ? "시각적 무드"
        : "가볍게 전환되는 템포"
  } 쪽으로 점수를 보정했습니다.`;

  return `${first.category}부터 시작해 몰입도를 먼저 올리고 ${last.category}로 감정선을 마무리했습니다. ${intro} ${preferenceCopy} ${modeCopy}`;
}

function buildReason(
  mode: PlannerMode,
  steps: PlannerStep[],
  scenarioId: ScenarioId,
  preferences: UserPreferences
) {
  return buildReasonFromIntro(mode, steps, scenarios[scenarioId].intro, preferences);
}

function getScoreLabel(overall: number) {
  if (overall >= 92) {
    return "매우 안정적";
  }
  if (overall >= 86) {
    return "추천 가능";
  }
  return "조정 여지 있음";
}

export function getScenarioSummaries(): ScenarioSummary[] {
  return scenarioSummaries;
}

function walkIntensityFromTransfer(transferLabel: string, transferMinutes: number): PlannerStep["walkIntensity"] {
  if (transferLabel.includes("도보") && transferMinutes >= 7) {
    return "medium";
  }

  if (transferLabel.includes("walk") && transferMinutes >= 7) {
    return "medium";
  }

  return transferMinutes >= 11 ? "high" : "low";
}

function mapActivityCategory(category: ActivityCategory) {
  switch (category) {
    case "movie":
      return "영화";
    case "cafe":
      return "카페";
    case "dinner":
      return "식사";
    case "bar":
      return "바";
    case "gallery":
      return "전시";
    case "walk":
      return "산책";
    default:
      return "활동";
  }
}

function mapTransitLabel(transitMode: "walk" | "bus" | "subway" | "taxi") {
  switch (transitMode) {
    case "walk":
      return "도보";
    case "bus":
      return "버스";
    case "subway":
      return "지하철";
    case "taxi":
      return "택시";
    default:
      return transitMode;
  }
}

function buildCustomAltPanel(recommendation: RecommendationResponse): PlannerAltPanel {
  const cafeCandidate = recommendation.candidates.find((candidate) => candidate.category === "cafe");

  if (!cafeCandidate) {
    return {
      title: "현재 코스는 바로 이동 가능한 상태예요",
      copy: "선택한 조합 기준으로 동선과 예산이 크게 무너지지 않도록 정리했습니다.",
      name: "대안 준비 중",
      meta: "실데이터 연결 후 비슷한 후보를 더 제안합니다.",
      canSwap: false,
      swapped: false,
    };
  }

  return {
    title: "비슷한 분위기의 대안을 더 붙일 수 있어요",
    copy: "실데이터 연결이 완료되면 같은 결의 장소를 주변에서 더 정밀하게 교체할 수 있습니다.",
    name: cafeCandidate.name,
    meta: `${mapTransitLabel(cafeCandidate.transitMode)} ${cafeCandidate.travelMinutes}분 · ${formatCurrency(cafeCandidate.estimatedCost)} · ${cafeCandidate.source}`,
    canSwap: false,
    swapped: false,
  };
}

export function buildCustomPlanner(input: {
  recommendation: RecommendationResponse;
  district: string;
  originLabel: string;
  categories: ActivityCategory[];
  mode: PlannerMode;
  preferences?: Partial<UserPreferences>;
}): PlannerResult {
  const preferences = normalizePreferences(input.preferences);
  const steps: PlannerStep[] = input.recommendation.candidates.map((candidate) => ({
    id: candidate.id,
    category: mapActivityCategory(candidate.category),
    title: candidate.name,
    description: candidate.reviewSummary
      ? `${candidate.description} ${candidate.reviewSummary.summary}${
          candidate.timing ? ` ${candidate.timing.note}` : ""
        }`
      : `${candidate.description}${candidate.timing ? ` ${candidate.timing.note}` : ""}`,
    slot: `${candidate.district} · ${candidate.concept}`,
    stayMinutes: candidate.stayMinutes,
    stayLabel: `${candidate.stayMinutes}분`,
    transferLabel: `${mapTransitLabel(candidate.transitMode)} ${candidate.travelMinutes}분`,
    transferMinutes: candidate.travelMinutes,
    priceValue: candidate.estimatedCost,
    priceLabel: formatCurrency(candidate.estimatedCost),
    trustScore: Math.round((candidate.reviewSummary?.score ?? 4) * 20),
    walkIntensity: walkIntensityFromTransfer(candidate.transitMode, candidate.travelMinutes),
    tags: Array.from(
      new Set([
        ...candidate.tags,
        ...(candidate.fitBadges?.map((badge) => badge.label) ?? []),
        ...(candidate.timing
          ? [
              candidate.timing.crowdLabel === "붐빔" ? "혼잡 시간대" : "시간대 무난",
              candidate.timing.estimatedWaitMinutes > 0
                ? `예상 대기 ${candidate.timing.estimatedWaitMinutes}분`
                : "대기 부담 적음",
            ]
          : []),
        ...(candidate.reviewSummary?.strengths ?? []),
        candidate.source === "kakao" ? "실데이터" : "목업 데이터",
      ])
    ).slice(0, 5),
  }));

  const totalCost = steps.reduce((sum, step) => sum + step.priceValue, 0);
  const totalMinutes = steps.reduce((sum, step) => sum + step.stayMinutes + step.transferMinutes, 0);
  const totalTransfer = steps.reduce((sum, step) => sum + step.transferMinutes, 0);
  const scores = computeScoresForBaseMood(88, steps, totalCost, preferences);
  const intro = `${input.originLabel} 기준 ${input.district}에서 직접 선택한 활동 조합으로 만든 커스텀 코스입니다.`;
  const preferenceSummary = `${formatCurrency(preferences.budgetCap)} 기준 · ${
    preferences.walkPreference === "easy"
      ? "도보 적게"
      : preferences.walkPreference === "balanced"
        ? "도보 보통"
        : "도보 괜찮음"
  } · ${
    preferences.vibePreference === "quiet"
      ? "조용한 무드"
      : preferences.vibePreference === "cinematic"
        ? "무드 우선"
        : "가벼운 템포"
  }${preferences.indoorPriority ? " · 실내 우선" : ""}`;

  return {
    id: "custom",
    mode: input.mode,
    label: `${input.district} 커스텀 데이트 플랜`,
    banner: "Custom generated route",
    intro,
    startLabel: input.originLabel,
    budgetLabel: formatCurrency(preferences.budgetCap),
    durationLabel: formatMinutes(totalMinutes),
    totalCostLabel: formatCurrency(totalCost),
    totalTransferLabel: `${formatMinutes(totalTransfer)} 이동`,
    scoreLabel: getScoreLabel(scores.overall),
    reason: buildReasonFromIntro(input.mode, steps, intro, preferences),
    preferenceSummary,
    preferences,
    profile: {
      headline: `${input.district}에서 바로 쓰는 맞춤형 코스`,
      description: input.recommendation.explanation,
      tags: input.categories.map(mapActivityCategory),
    },
    steps,
    scores,
    altPanel: buildCustomAltPanel(input.recommendation),
    modeNotes: {
      p: [
        "지금 선택한 조합에서 다음 단계만 빠르게 실행하기 좋습니다.",
        "현장 상황에 따라 같은 지역 안에서 다시 추천받기 쉽습니다.",
        "채팅형 흐름으로 바꾸기 좋은 커스텀 코스입니다.",
      ],
      j: [
        "직접 고른 활동 조합을 기준으로 순서를 더 세밀하게 조정할 수 있습니다.",
        "예산과 이동 피로를 즉시 다시 확인할 수 있습니다.",
        "공유 링크로 상대와 함께 고치기 쉬운 구조입니다.",
      ],
    },
  };
}

export function getPlannerState(input: {
  scenarioId: ScenarioId;
  mode: PlannerMode;
  stepIds?: string[];
  swapAlternative?: boolean;
  preferences?: Partial<UserPreferences>;
}): PlannerResult {
  const scenario = scenarios[input.scenarioId];
  const preferences = normalizePreferences(input.preferences);
  let steps = reorderSteps(scenario.steps, input.stepIds).map((step) => ({ ...step }));

  if (input.swapAlternative) {
    steps = replaceAlternative(input.scenarioId, steps);
  }

  const totalCost = steps.reduce((sum, step) => sum + step.priceValue, 0);
  const totalMinutes = steps.reduce((sum, step) => sum + step.stayMinutes + step.transferMinutes, 0);
  const totalTransfer = steps.reduce((sum, step) => sum + step.transferMinutes, 0);
  const scores = computeScores(input.scenarioId, steps, totalCost, preferences);

  const preferenceSummary = `${formatCurrency(preferences.budgetCap)} 기준 · ${
    preferences.walkPreference === "easy"
      ? "도보 적게"
      : preferences.walkPreference === "balanced"
        ? "도보 보통"
        : "도보 괜찮음"
  } · ${
    preferences.vibePreference === "quiet"
      ? "조용한 무드"
      : preferences.vibePreference === "cinematic"
        ? "무드 우선"
        : "가벼운 템포"
  }${preferences.indoorPriority ? " · 실내 우선" : ""}`;

  return {
    id: scenario.id,
    mode: input.mode,
    label: scenario.label,
    banner: scenario.banner,
    intro: scenario.intro,
    startLabel: scenario.startLabel,
    budgetLabel: formatCurrency(scenario.budgetCap),
    durationLabel: formatMinutes(totalMinutes),
    totalCostLabel: formatCurrency(totalCost),
    totalTransferLabel: `${formatMinutes(totalTransfer)} 이동`,
    scoreLabel: getScoreLabel(scores.overall),
    reason: buildReason(input.mode, steps, input.scenarioId, preferences),
    preferenceSummary,
    preferences,
    profile: scenario.profile,
    steps,
    scores,
    altPanel: {
      title: input.swapAlternative ? "대안을 이미 반영했어요" : scenario.altPanel.title,
      copy: input.swapAlternative
        ? "현재 코스에 대안을 적용해 이동 흐름을 더 부드럽게 바꿨습니다."
        : scenario.altPanel.copy,
      name: scenario.altPanel.candidate.title,
      meta: `${scenario.altPanel.candidate.transferLabel} · ${formatCurrency(scenario.altPanel.candidate.priceValue)} · ${scenario.altPanel.candidate.tags[0]}`,
      canSwap: !input.swapAlternative,
      swapped: Boolean(input.swapAlternative),
    },
    modeNotes: {
      p: [
        "다음 단계만 먼저 보여줘서 결정 피로가 적습니다.",
        "웨이팅과 날씨 변수에 빠르게 대응하기 좋습니다.",
        "대화형 문장 중심으로 안내해 앱 사용 부담을 줄입니다.",
      ],
      j: [
        "순서와 총 이동 시간을 눈으로 확인하며 조정할 수 있습니다.",
        "수정 직후 완성도 점수가 다시 계산됩니다.",
        "저장과 공유 기능으로 확장하기 좋은 편집형 구조입니다.",
      ],
    },
  };
}
