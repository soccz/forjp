"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { getSeoulWeather, type WeatherInfo } from "@/lib/weather";
import type {
  ActivityCategory,
  ChatCollected,
  ProviderDiagnostics,
  PlannerResult,
  PlannerMode,
  PlanVariant,
  RecommendationResponse,
  SavedPlan,
  SavedPlansResponse,
  ScenarioSummary,
  ScenarioId,
  UserPreferences,
  VibePreference,
  WalkPreference,
} from "@/lib/types";
import { AuthButton } from "@/components/auth-button";
import { ChatPlanner } from "@/components/chat-planner";
import { optimizeRoute, type RouteOptimizationResult } from "@/lib/route-optimizer";
import { buildPlanVariants } from "@/lib/plan-variants";
import { OnboardingModal } from "@/components/onboarding-modal";
import { TimePicker } from "@/components/time-picker";
import { CourseProgress, type CourseProgressState } from "@/components/course-progress";
import { KakaoShareButton } from "@/components/kakao-share-button";
import { VenueInputForm, type CustomVenueInput } from "@/components/venue-input-form";
import type { VenueCandidate } from "@/lib/types";
import { RecommendationSkeleton } from "@/components/skeleton-loader";
import { PlanTimeline, buildTimelineStops } from "@/components/plan-timeline";

type DatePlannerAppProps = {
  initialPlanner: PlannerResult;
  scenarios: ScenarioSummary[];
};

type AppPanel = "planner" | "profile" | "modes";
type WorkspacePanel = "recommend" | "plan" | "insights";

const budgetChoices = [50000, 80000, 120000];
const walkChoices: { value: WalkPreference; label: string }[] = [
  { value: "easy", label: "도보 적게" },
  { value: "balanced", label: "도보 보통" },
  { value: "adventurous", label: "도보 괜찮음" },
];
const vibeChoices: { value: VibePreference; label: string }[] = [
  { value: "quiet", label: "조용한 무드" },
  { value: "cinematic", label: "무드 우선" },
  { value: "playful", label: "가벼운 템포" },
];
const districtChoices = ["성수", "홍대", "강남", "을지로", "이태원", "합정", "건대", "잠실"];
const DISTRICT_HINTS: Record<string, string> = {
  성수: "2호선 성수역 · 힙한 카페거리",
  홍대: "2호선 홍대입구역 · 젊고 활기찬",
  강남: "2·9호선 강남역 · 세련되고 다양",
  을지로: "2호선 을지로3가역 · 빈티지 감성",
  이태원: "6호선 이태원역 · 이국적 분위기",
  합정: "2·6호선 합정역 · 아늑하고 감성적",
  건대: "2·7호선 건대입구역 · 활발한 상권",
  잠실: "2·8호선 잠실역 · 넓고 쾌적",
};
const categoryChoices: { value: ActivityCategory; label: string }[] = [
  { value: "movie", label: "영화" },
  { value: "cafe", label: "카페" },
  { value: "dinner", label: "식사" },
  { value: "bar", label: "술" },
  { value: "gallery", label: "전시" },
  { value: "walk", label: "산책/실내활동" },
];
const quickPlanPresets: {
  id: string;
  label: string;
  description: string;
  district: string;
  categories: ActivityCategory[];
  preferences: UserPreferences;
}[] = [
  {
    id: "blind-safe",
    label: "소개팅 안전형",
    description: "대화 중심, 도보 적게, 실패 확률 낮게",
    district: "강남",
    categories: ["cafe", "dinner", "walk"],
    preferences: {
      budgetCap: 80000,
      walkPreference: "easy",
      vibePreference: "quiet",
      indoorPriority: true,
    },
  },
  {
    id: "afterwork-fast",
    label: "퇴근 후 3시간",
    description: "짧고 밀도 있게, 이동 피로 최소화",
    district: "을지로",
    categories: ["dinner", "bar", "walk"],
    preferences: {
      budgetCap: 80000,
      walkPreference: "easy",
      vibePreference: "playful",
      indoorPriority: false,
    },
  },
  {
    id: "anniversary-mood",
    label: "기념일 무드형",
    description: "분위기와 사진 포인트를 우선",
    district: "성수",
    categories: ["gallery", "cafe", "dinner"],
    preferences: {
      budgetCap: 120000,
      walkPreference: "balanced",
      vibePreference: "cinematic",
      indoorPriority: true,
    },
  },
  {
    id: "rainy-date",
    label: "비 오는 날",
    description: "실내 중심으로 끊기지 않게",
    district: "홍대",
    categories: ["movie", "cafe", "dinner"],
    preferences: {
      budgetCap: 50000,
      walkPreference: "easy",
      vibePreference: "quiet",
      indoorPriority: true,
    },
  },
];
const SAVED_PLANS_KEY = "couple.savedPlans";
const OWNER_KEY_STORAGE = "couple.ownerKey";

function getCategoryLabel(category: ActivityCategory) {
  return categoryChoices.find((choice) => choice.value === category)?.label ?? category;
}

function getWalkLabel(walkPreference: WalkPreference) {
  return walkChoices.find((choice) => choice.value === walkPreference)?.label ?? walkPreference;
}

function getVibeLabel(vibePreference: VibePreference) {
  return vibeChoices.find((choice) => choice.value === vibePreference)?.label ?? vibePreference;
}

async function postPlannerUpdate(payload: {
  scenarioId: ScenarioId;
  mode: PlannerMode;
  stepIds?: string[];
  swapAlternative?: boolean;
  preferences?: UserPreferences;
}) {
  const response = await fetch("/api/planner", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error("planner_update_failed");
  }

  return (await response.json()) as PlannerResult;
}

async function fetchSavedPlans(ownerKey: string) {
  const response = await fetch(`/api/saved-plans?ownerKey=${encodeURIComponent(ownerKey)}`);

  if (!response.ok) {
    throw new Error("saved_plan_fetch_failed");
  }

  return (await response.json()) as SavedPlansResponse;
}

async function postSavedPlan(ownerKey: string, plan: SavedPlan) {
  const response = await fetch("/api/saved-plans", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ ownerKey, plan }),
  });

  if (!response.ok) {
    throw new Error("saved_plan_post_failed");
  }

  return (await response.json()) as { plan: SavedPlan; source: "supabase" | "local" };
}

async function postRecommendation(payload: {
  district: string;
  originLabel: string;
  categories: ActivityCategory[];
  preferences: UserPreferences;
  selectedCandidateIds?: string[];
}) {
  const response = await fetch("/api/recommendations", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error("recommendation_failed");
  }

  return (await response.json()) as RecommendationResponse;
}

async function postCustomPlan(payload: {
  district: string;
  originLabel: string;
  categories: ActivityCategory[];
  preferences: UserPreferences;
  mode: PlannerMode;
  stepIds?: string[];
  selectedCandidateIds?: string[];
}) {
  const response = await fetch("/api/custom-plan", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error("custom_plan_failed");
  }

  return (await response.json()) as PlannerResult;
}

async function fetchDiagnostics() {
  const response = await fetch("/api/diagnostics");

  if (!response.ok) {
    throw new Error("diagnostics_failed");
  }

  return (await response.json()) as ProviderDiagnostics;
}

function getOrCreateOwnerKey() {
  const existing = window.localStorage.getItem(OWNER_KEY_STORAGE);

  if (existing) {
    return existing;
  }

  const created =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `owner-${Date.now()}`;
  window.localStorage.setItem(OWNER_KEY_STORAGE, created);
  return created;
}

function persistLocalPlans(plans: SavedPlan[]) {
  window.localStorage.setItem(SAVED_PLANS_KEY, JSON.stringify(plans));
}

export function DatePlannerApp({ initialPlanner, scenarios }: DatePlannerAppProps) {
  const [planner, setPlanner] = useState(initialPlanner);
  const [mode, setMode] = useState<PlannerMode>(initialPlanner.mode);
  const [preferences, setPreferences] = useState<UserPreferences>(initialPlanner.preferences);
  const [savedPlans, setSavedPlans] = useState<SavedPlan[]>([]);
  const [storageSource, setStorageSource] = useState<"supabase" | "local">("local");
  const [district, setDistrict] = useState("성수");
  const [originLabel, setOriginLabel] = useState(initialPlanner.startLabel);
  const [selectedCategories, setSelectedCategories] = useState<ActivityCategory[]>([
    "movie",
    "cafe",
    "dinner",
  ]);
  const [recommendation, setRecommendation] = useState<RecommendationResponse | null>(null);
  const [selectedCandidateIds, setSelectedCandidateIds] = useState<string[]>([]);
  const [recommendationError, setRecommendationError] = useState<string | null>(null);
  const [isRecommendationLoading, setIsRecommendationLoading] = useState(false);
  const [diagnostics, setDiagnostics] = useState<ProviderDiagnostics | null>(null);
  const [shareMessage, setShareMessage] = useState<string | null>(null);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [customVenues, setCustomVenues] = useState<VenueCandidate[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [activePanel, setActivePanel] = useState<AppPanel>("planner");
  const [activeWorkspacePanel, setActiveWorkspacePanel] = useState<WorkspacePanel>("plan");
  const hasAutoLoaded = useRef(false);
  const busy = isLoading || isPending;
  const [showOnboarding, setShowOnboarding] = useState(false);

  // Weather
  const [weather, setWeather] = useState<WeatherInfo | null>(null);

  // Surprise mode
  const [surpriseMode, setSurpriseMode] = useState(false);

  // P mode chat & plan variants
  const [chatCompleted, setChatCompleted] = useState(false);
  const [planVariants, setPlanVariants] = useState<PlanVariant[]>([]);
  const [rainMode, setRainMode] = useState(false);

  // J mode: route optimization
  const [routeOptimization, setRouteOptimization] = useState<RouteOptimizationResult | null>(null);

  // J mode: per-step alternatives
  const [expandedAltStepId, setExpandedAltStepId] = useState<string | null>(null);

  // Start time
  const [startTime, setStartTime] = useState("19:00");

  // Timeline view toggle
  const [showTimeline, setShowTimeline] = useState(false);

  // Course progress
  const [courseProgress, setCourseProgress] = useState<CourseProgressState | null>(null);

  useEffect(() => {
    if (!window.localStorage.getItem("couple.onboarded")) {
      setShowOnboarding(true);
    }
    try {
      const stored = window.localStorage.getItem(SAVED_PLANS_KEY);
      if (!stored) {
        void fetchSavedPlans(getOrCreateOwnerKey())
          .then((response) => {
            if (response.plans.length > 0) {
              setSavedPlans(response.plans);
              setStorageSource(response.source);
              persistLocalPlans(response.plans);
            }
          })
          .catch(() => {
            setStorageSource("local");
          });
        return;
      }

      const parsed = JSON.parse(stored) as SavedPlan[];
      setSavedPlans(parsed);
      void fetchSavedPlans(getOrCreateOwnerKey())
        .then((response) => {
          if (response.plans.length > 0) {
            setSavedPlans(response.plans);
            setStorageSource(response.source);
            persistLocalPlans(response.plans);
            return;
          }

          setStorageSource(response.source);
        })
        .catch(() => {
          setStorageSource("local");
        });
    } catch {
      window.localStorage.removeItem(SAVED_PLANS_KEY);
    }
  }, []);

  useEffect(() => {
    getSeoulWeather().then((w) => {
      setWeather(w);
      if (w?.isRainy) setRainMode(true);
    });
  }, []);

  useEffect(() => {
    void fetchDiagnostics()
      .then((nextDiagnostics) => setDiagnostics(nextDiagnostics))
      .catch(() => undefined);
    void loadRecommendation(
      district,
      selectedCategories,
      preferences,
      originLabel,
      selectedCandidateIds
    );
    // Initial load should happen once with the current defaults.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!hasAutoLoaded.current) {
      hasAutoLoaded.current = true;
      return;
    }

    const timeoutId = window.setTimeout(() => {
      void loadRecommendation(
        district,
        selectedCategories,
        preferences,
        originLabel,
        selectedCandidateIds
      );
    }, 260);

    return () => window.clearTimeout(timeoutId);
  }, [district, selectedCategories, preferences, originLabel, selectedCandidateIds]);

  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const urlDistrict = searchParams.get("district");
    const urlOrigin = searchParams.get("origin");
    const urlMode = searchParams.get("mode");
    const urlCategories = searchParams.get("categories");
    const budgetCap = Number(searchParams.get("budgetCap") ?? "");
    const walkPreference = searchParams.get("walkPreference");
    const vibePreference = searchParams.get("vibePreference");
    const indoorPriority = searchParams.get("indoorPriority");
    const selectedIds = searchParams.get("selectedIds");

    if (!urlDistrict || !urlCategories) {
      return;
    }

    const parsedCategories = urlCategories
      .split(",")
      .filter(Boolean) as ActivityCategory[];

    if (parsedCategories.length === 0) {
      return;
    }

    const nextPreferences: UserPreferences = {
      budgetCap: Number.isFinite(budgetCap) && budgetCap > 0 ? budgetCap : preferences.budgetCap,
      walkPreference:
        walkPreference === "easy" || walkPreference === "balanced" || walkPreference === "adventurous"
          ? walkPreference
          : preferences.walkPreference,
      vibePreference:
        vibePreference === "quiet" || vibePreference === "cinematic" || vibePreference === "playful"
          ? vibePreference
          : preferences.vibePreference,
      indoorPriority: indoorPriority === "true",
    };

    setDistrict(urlDistrict);
    setOriginLabel(urlOrigin ?? planner.startLabel);
    setSelectedCategories(parsedCategories);
    setPreferences(nextPreferences);
    setSelectedCandidateIds(selectedIds?.split(",").filter(Boolean) ?? []);

    void applyCustomPlan({
      district: urlDistrict,
      originLabel: urlOrigin ?? planner.startLabel,
      categories: parsedCategories,
      preferences: nextPreferences,
      mode: urlMode === "p" || urlMode === "j" ? urlMode : mode,
      stepIds: searchParams.get("stepIds")?.split(",").filter(Boolean),
      selectedCandidateIds: selectedIds?.split(",").filter(Boolean),
    });
    // URL hydration should run once on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function syncPlanner(payload: {
    scenarioId: ScenarioId;
    mode: PlannerMode;
    stepIds?: string[];
    swapAlternative?: boolean;
    preferences?: UserPreferences;
  }) {
    setIsLoading(true);

    void postPlannerUpdate(payload)
      .then((nextPlanner) => {
        startTransition(() => {
          setPlanner(nextPlanner);
          setMode(nextPlanner.mode);
          setPreferences(nextPlanner.preferences);
          setErrorMessage(null);
        });
      })
      .catch(() => {
        startTransition(() => {
          setErrorMessage("코스를 다시 계산하지 못했습니다. 잠시 후 다시 시도해주세요.");
        });
      })
      .finally(() => {
        setIsLoading(false);
      });
  }

  function handleScenarioChange(nextScenarioId: ScenarioId) {
    syncPlanner({ scenarioId: nextScenarioId, mode, preferences });
  }

  function handleModeChange(nextMode: PlannerMode) {
    if (planner.id === "custom") {
      void applyCustomPlan({
        district,
        originLabel,
        categories: selectedCategories,
        preferences,
        mode: nextMode,
        stepIds: planner.steps.map((step) => step.id),
        selectedCandidateIds,
      });
      return;
    }

    setMode(nextMode);
    syncPlanner({
      scenarioId: planner.id,
      mode: nextMode,
      stepIds: planner.steps.map((step) => step.id),
      swapAlternative: planner.altPanel.swapped,
      preferences,
    });
  }

  function moveStep(stepId: string, direction: "up" | "down") {
    const currentIndex = planner.steps.findIndex((step) => step.id === stepId);
    const targetIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;

    if (currentIndex === -1 || targetIndex < 0 || targetIndex >= planner.steps.length) {
      return;
    }

    const reorderedSteps = [...planner.steps];
    const [movedStep] = reorderedSteps.splice(currentIndex, 1);
    reorderedSteps.splice(targetIndex, 0, movedStep);

    if (planner.id === "custom") {
      void applyCustomPlan({
        district,
        originLabel,
        categories: selectedCategories,
        preferences,
        mode,
        stepIds: reorderedSteps.map((step) => step.id),
        selectedCandidateIds,
      });
      return;
    }

    syncPlanner({
      scenarioId: planner.id,
      mode,
      stepIds: reorderedSteps.map((step) => step.id),
      swapAlternative: planner.altPanel.swapped,
      preferences,
    });
  }

  function swapAlternative() {
    if (!planner.altPanel.canSwap || planner.id === "custom") {
      return;
    }

    syncPlanner({
      scenarioId: planner.id,
      mode,
      stepIds: planner.steps.map((step) => step.id),
      swapAlternative: true,
      preferences,
    });
  }

  function updatePreferences(nextPreferences: UserPreferences) {
    setPreferences(nextPreferences);

    if (planner.id === "custom") {
      void applyCustomPlan({
        district,
        originLabel,
        categories: selectedCategories,
        preferences: nextPreferences,
        mode,
        stepIds: planner.steps.map((step) => step.id),
        selectedCandidateIds,
      });
      return;
    }

    syncPlanner({
      scenarioId: planner.id,
      mode,
      stepIds: planner.steps.map((step) => step.id),
      swapAlternative: planner.altPanel.swapped,
      preferences: nextPreferences,
    });
  }

  function saveCurrentPlan() {
    const ownerKey = getOrCreateOwnerKey();
    const nextPlan: SavedPlan = {
      id: `${planner.id}-${Date.now()}`,
      scenarioId: planner.id,
      label: planner.label,
      mode,
      score: planner.scores.overall,
      savedAt: new Date().toISOString(),
      preferences,
      stepIds: planner.steps.map((step) => step.id),
      swapAlternative: planner.altPanel.swapped,
      customConfig:
        planner.id === "custom"
          ? {
              district,
              originLabel,
              categories: selectedCategories,
              selectedCandidateIds,
            }
          : undefined,
    };

    const nextSavedPlans: SavedPlan[] = [nextPlan, ...savedPlans].slice(0, 5);
    setSavedPlans(nextSavedPlans);
    persistLocalPlans(nextSavedPlans);

    void postSavedPlan(ownerKey, nextPlan)
      .then((response) => {
        setStorageSource(response.source);
      })
      .catch(() => {
        setStorageSource("local");
      });
  }

  function restoreSavedPlan(savedPlan: SavedPlan) {
    if (savedPlan.scenarioId === "custom" && savedPlan.customConfig) {
      setDistrict(savedPlan.customConfig.district);
      setOriginLabel(savedPlan.customConfig.originLabel);
      setSelectedCategories(savedPlan.customConfig.categories);
      setSelectedCandidateIds(savedPlan.customConfig.selectedCandidateIds ?? []);
      setPreferences(savedPlan.preferences);
      void applyCustomPlan({
        district: savedPlan.customConfig.district,
        originLabel: savedPlan.customConfig.originLabel,
        categories: savedPlan.customConfig.categories,
        preferences: savedPlan.preferences,
        mode: savedPlan.mode,
        selectedCandidateIds: savedPlan.customConfig.selectedCandidateIds,
      });
      return;
    }

    syncPlanner({
      scenarioId: savedPlan.scenarioId as ScenarioId,
      mode: savedPlan.mode,
      stepIds: savedPlan.stepIds,
      swapAlternative: savedPlan.swapAlternative,
      preferences: savedPlan.preferences,
    });
    setPreferences(savedPlan.preferences);
  }

  async function loadRecommendation(
    nextDistrict: string,
    nextCategories: ActivityCategory[],
    nextPreferences: UserPreferences,
    nextOriginLabel: string,
    nextSelectedCandidateIds?: string[]
  ) {
    if (nextCategories.length === 0) {
      setRecommendation(null);
      setRecommendationError("활동을 최소 한 개 이상 선택해주세요.");
      return;
    }

    setIsRecommendationLoading(true);

    try {
      const nextRecommendation = await postRecommendation({
        district: nextDistrict,
        originLabel: nextOriginLabel,
        categories: nextCategories,
        preferences: nextPreferences,
        selectedCandidateIds: nextSelectedCandidateIds,
      });
      setRecommendation(nextRecommendation);
      setRecommendationError(null);

      // Compute route optimization from loaded candidates
      const districtCenters: Record<string, { latitude: number; longitude: number }> = {
        성수: { latitude: 37.5446, longitude: 127.0557 },
        홍대: { latitude: 37.5563, longitude: 126.9236 },
        강남: { latitude: 37.4979, longitude: 127.0276 },
        을지로: { latitude: 37.5663, longitude: 126.9911 },
        이태원: { latitude: 37.5340, longitude: 126.9947 },
        합정: { latitude: 37.5497, longitude: 126.9142 },
        건대: { latitude: 37.5403, longitude: 127.0699 },
        잠실: { latitude: 37.5133, longitude: 127.1001 },
      };
      const origin = districtCenters[nextDistrict] ?? districtCenters["성수"];
      const perCategory = nextCategories
        .map((cat) => nextRecommendation.candidates.find((c) => c.category === cat))
        .filter((c): c is NonNullable<typeof c> => c !== null && c !== undefined);
      if (perCategory.length > 1) {
        setRouteOptimization(optimizeRoute(origin, perCategory));
      } else {
        setRouteOptimization(null);
      }

      // Build plan variants for P mode
      if (nextRecommendation.candidates.length > 0) {
        setPlanVariants(buildPlanVariants(nextRecommendation.candidates, nextCategories, origin));
      }
    } catch {
      setRecommendationError("동적 추천을 불러오지 못했습니다.");
    } finally {
      setIsRecommendationLoading(false);
    }
  }

  function toggleCategory(category: ActivityCategory) {
    const nextCategories = selectedCategories.includes(category)
      ? selectedCategories.filter((item) => item !== category)
      : [...selectedCategories, category];

    setSelectedCandidateIds([]);
    setSelectedCategories(nextCategories);
  }

  function applyQuickPreset(presetId: string) {
    const preset = quickPlanPresets.find((item) => item.id === presetId);

    if (!preset) {
      return;
    }

    setDistrict(preset.district);
    setSelectedCategories(preset.categories);
    setPreferences(preset.preferences);
    setSelectedCandidateIds([]);
    setOriginLabel(`${preset.district}역 메인 출구`);
    setShareMessage(null);
    setErrorMessage(null);
  }

  async function applyCustomPlan(payload: {
    district: string;
    originLabel: string;
    categories: ActivityCategory[];
    preferences: UserPreferences;
    mode: PlannerMode;
    stepIds?: string[];
    selectedCandidateIds?: string[];
  }) {
    setIsLoading(true);

    try {
      const nextPlanner = await postCustomPlan(payload);
      startTransition(() => {
        setPlanner(nextPlanner);
        setMode(nextPlanner.mode);
        setPreferences(nextPlanner.preferences);
        setDistrict(payload.district);
        setOriginLabel(payload.originLabel);
        setSelectedCategories(payload.categories);
        setSelectedCandidateIds(payload.selectedCandidateIds ?? []);
        setErrorMessage(null);
      });

      const params = new URLSearchParams({
        district: payload.district,
        origin: payload.originLabel,
        categories: payload.categories.join(","),
        mode: payload.mode,
        budgetCap: String(payload.preferences.budgetCap),
        walkPreference: payload.preferences.walkPreference,
        vibePreference: payload.preferences.vibePreference,
        indoorPriority: String(payload.preferences.indoorPriority),
      });
      if (payload.stepIds?.length) {
        params.set("stepIds", payload.stepIds.join(","));
      }
      if (payload.selectedCandidateIds?.length) {
        params.set("selectedIds", payload.selectedCandidateIds.join(","));
      }
      window.history.replaceState({}, "", `?${params.toString()}`);
    } catch {
      setErrorMessage("커스텀 플랜을 만들지 못했습니다. 잠시 후 다시 시도해주세요.");
    } finally {
      setIsLoading(false);
    }
  }

  async function shareCurrentPlan() {
    const params = {
      district,
      origin: originLabel,
      categories: selectedCategories.join(","),
      mode,
      budgetCap: String(preferences.budgetCap),
      walkPreference: preferences.walkPreference,
      vibePreference: preferences.vibePreference,
      indoorPriority: String(preferences.indoorPriority),
      ...(selectedCandidateIds.length ? { selectedIds: selectedCandidateIds.join(",") } : {}),
    };

    try {
      const res = await fetch("/api/shared-plans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: params, surpriseMode }),
      });
      if (res.ok) {
        const data = (await res.json()) as { url: string };
        setShareUrl(data.url);
        setShareMessage("공유 링크가 준비됐어요.");
        return;
      }
    } catch {
      // fall through to long URL
    }

    // Fallback: long URL
    const longParams = new URLSearchParams(params);
    const fallbackUrl = `${window.location.origin}${window.location.pathname}?${longParams.toString()}`;
    setShareUrl(fallbackUrl);
    try {
      await navigator.clipboard.writeText(fallbackUrl);
      setShareMessage("공유 링크를 복사했습니다.");
    } catch {
      setShareMessage(`공유 링크: ${fallbackUrl}`);
    }
  }

  function handleAddCustomVenue(input: CustomVenueInput) {
    const districtCentersLocal: Record<string, { latitude: number; longitude: number }> = {
      성수: { latitude: 37.5446, longitude: 127.0557 },
      홍대: { latitude: 37.5563, longitude: 126.9236 },
      강남: { latitude: 37.4979, longitude: 127.0276 },
      을지로: { latitude: 37.5663, longitude: 126.9911 },
      이태원: { latitude: 37.5340, longitude: 126.9947 },
      합정: { latitude: 37.5497, longitude: 126.9142 },
      건대: { latitude: 37.5403, longitude: 127.0699 },
      잠실: { latitude: 37.5133, longitude: 127.1001 },
    };
    const center = districtCentersLocal[district] ?? districtCentersLocal["성수"];

    const newVenue: VenueCandidate = {
      id: `custom-${Date.now()}-${customVenues.length}`,
      name: input.name,
      category: input.category,
      district,
      concept: "직접 추가한 장소",
      description: input.notes ?? `${district}의 ${input.name}`,
      transitMode: "walk",
      travelMinutes: 10,
      stayMinutes: 60,
      estimatedCost: 15000,
      quietScore: 3,
      visualScore: 3,
      indoor: input.category !== "walk",
      latitude: center.latitude + (Math.random() - 0.5) * 0.01,
      longitude: center.longitude + (Math.random() - 0.5) * 0.01,
      source: "mock",
      tags: ["직접 추가", input.category],
    };

    const nextCustomVenues = [...customVenues, newVenue];
    setCustomVenues(nextCustomVenues);

    const nextIds = [...selectedCandidateIds, newVenue.id];
    setSelectedCandidateIds(nextIds);

    if (!selectedCategories.includes(input.category)) {
      setSelectedCategories([...selectedCategories, input.category]);
    }
  }

  async function fetchQuickRecommend(quickCollected: ChatCollected) {
    const districtCenters: Record<string, { latitude: number; longitude: number }> = {
      성수: { latitude: 37.5446, longitude: 127.0557 },
      홍대: { latitude: 37.5563, longitude: 126.9236 },
      강남: { latitude: 37.4979, longitude: 127.0276 },
      을지로: { latitude: 37.5663, longitude: 126.9911 },
      이태원: { latitude: 37.5340, longitude: 126.9947 },
      합정: { latitude: 37.5497, longitude: 126.9142 },
      건대: { latitude: 37.5403, longitude: 127.0699 },
      잠실: { latitude: 37.5133, longitude: 127.1001 },
    };
    setIsRecommendationLoading(true);
    try {
      const res = await fetch("/api/recommendations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          district: quickCollected.district,
          originLabel: quickCollected.district,
          categories: quickCollected.categories,
          preferences: {
            budgetCap: quickCollected.budgetCap,
            walkPreference: "balanced",
            vibePreference: quickCollected.vibe,
            indoorPriority: false,
          },
        }),
      });
      if (!res.ok) throw new Error("quick_recommend_failed");
      const data = (await res.json()) as { candidates?: import("@/lib/types").VenueCandidate[] };
      const candidates = data.candidates ?? [];
      const origin = districtCenters[quickCollected.district] ?? districtCenters["성수"];
      const variants = buildPlanVariants(candidates, quickCollected.categories, origin);
      setChatCompleted(true);
      setPlanVariants(variants);
      setDistrict(quickCollected.district);
      setSelectedCategories(quickCollected.categories);
      setPreferences({
        ...preferences,
        budgetCap: quickCollected.budgetCap,
        vibePreference: quickCollected.vibe,
      });
      setActiveWorkspacePanel("plan");
    } catch {
      setRecommendationError("빠른 추천을 불러오지 못했습니다.");
    } finally {
      setIsRecommendationLoading(false);
    }
  }

  function handleQuickStart() {
    const hour = new Date().getHours();
    const quickCollected: ChatCollected = {
      district: "성수",
      startTime: `${hour.toString().padStart(2, "0")}:00`,
      vibe: hour >= 20 ? "cinematic" : hour >= 17 ? "quiet" : "playful",
      budgetCap: 60000,
      categories: ["cafe", "dinner", "movie"],
    };
    void fetchQuickRecommend(quickCollected);
  }

  function applyCandidateAlternative(currentCandidateId: string, nextCandidateId: string) {
    const nextSelectedCandidateIds = Array.from(
      new Set([
        ...selectedCandidateIds.filter((candidateId) => candidateId !== currentCandidateId),
        nextCandidateId,
      ])
    );

    setSelectedCandidateIds(nextSelectedCandidateIds);
    setShareMessage(null);
  }

  return (
    <>
      {showOnboarding && (
        <OnboardingModal
          onDismiss={() => {
            window.localStorage.setItem("couple.onboarded", "1");
            setShowOnboarding(false);
          }}
        />
      )}
    <main className="shell">
      <header className="masthead">
        <div className="brand">
          <div className="brand__mark">C</div>
          <div>
            <p className="eyebrow">Transit-first planner</p>
            <h1>COUPLE</h1>
          </div>
        </div>
        <nav className="masthead__nav" aria-label="주요 섹션">
          <button
            type="button"
            className={activePanel === "planner" ? "nav-tab is-active" : "nav-tab"}
            onClick={() => setActivePanel("planner")}
          >
            코스
          </button>
          <button
            type="button"
            className={activePanel === "profile" ? "nav-tab is-active" : "nav-tab"}
            onClick={() => setActivePanel("profile")}
          >
            취향
          </button>
          <button
            type="button"
            className={activePanel === "modes" ? "nav-tab is-active" : "nav-tab"}
            onClick={() => setActivePanel("modes")}
          >
            모드
          </button>
        </nav>
        <AuthButton />
      </header>

      <section className="hero">
        <div className="hero__copy">
          <p className="eyebrow">서울 기준 데이트 플래너</p>
          <h2>지금 움직일 수 있는 데이트 코스</h2>
          <p className="hero__text">
            시간, 이동, 분위기를 한 번에 보고 바로 수정할 수 있게 정리했습니다. 긴 설명보다
            바로 쓰는 흐름에 집중했습니다.
          </p>

          <div className="hero__meta-row">
            <span className="hero-badge">출발 {planner.startLabel}</span>
            <span className="hero-badge">{mode === "p" ? "P 모드 즉흥형" : "J 모드 설계형"}</span>
            <span className="hero-badge">{planner.steps.length}개 코스</span>
          </div>

          <div className="hero__cta">
            <button
              type="button"
              className="button button--primary"
              onClick={() => setActivePanel("planner")}
            >
              코스 바로 보기
            </button>
            <button
              type="button"
              className="button button--ghost"
              onClick={() => setActivePanel("modes")}
            >
              P/J 모드 비교
            </button>
          </div>

          <dl className="hero__stats">
            <div>
              <dt>총 소요</dt>
              <dd>{planner.durationLabel}</dd>
            </div>
            <div>
              <dt>예산</dt>
              <dd>{planner.totalCostLabel}</dd>
            </div>
            <div>
              <dt>코스 점수</dt>
              <dd>{planner.scores.overall}점</dd>
            </div>
          </dl>
        </div>

        <div className="hero__rail">
          <article className="hero-card hero-card--plan">
            <div className="hero-card__header">
              <span>오늘 추천 스냅샷</span>
              <strong>{planner.label}</strong>
            </div>
            <div className="hero-route-list">
              {planner.steps.slice(0, 3).map((step, index) => (
                <div key={step.id} className="hero-route-item">
                  <span className="hero-route-item__index">{index + 1}</span>
                  <div>
                    <strong>{step.title}</strong>
                    <p>
                      {step.category} · {step.slot}
                    </p>
                  </div>
                </div>
              ))}
            </div>
            <p className="hero-card__caption">{planner.reason}</p>
          </article>

          <article className="hero-card hero-card--mode">
            <div className="hero-card__header">
              <span>현재 모드</span>
              <strong>{mode === "p" ? "P 모드" : "J 모드"}</strong>
            </div>
            <div className="hero-mode-grid">
              <button
                type="button"
                className={mode === "p" ? "hero-mode-tile is-active" : "hero-mode-tile"}
                onClick={() => handleModeChange("p")}
                disabled={busy}
              >
                <strong>P 모드</strong>
                <span>다음 한 단계 중심</span>
              </button>
              <button
                type="button"
                className={mode === "j" ? "hero-mode-tile is-active" : "hero-mode-tile"}
                onClick={() => handleModeChange("j")}
                disabled={busy}
              >
                <strong>J 모드</strong>
                <span>순서와 이동 직접 수정</span>
              </button>
            </div>
            <div className="hero-chip-row">
              <span className="token">{planner.startLabel}</span>
              <span className="token">{getWalkLabel(preferences.walkPreference)}</span>
              <span className="token">{getVibeLabel(preferences.vibePreference)}</span>
            </div>
          </article>
        </div>
      </section>

      <div className="panel-switcher" role="tablist" aria-label="화면 전환">
        <button
          type="button"
          className={activePanel === "planner" ? "panel-switcher__button is-active" : "panel-switcher__button"}
          onClick={() => setActivePanel("planner")}
        >
          코스
        </button>
        <button
          type="button"
          className={activePanel === "profile" ? "panel-switcher__button is-active" : "panel-switcher__button"}
          onClick={() => setActivePanel("profile")}
        >
          취향
        </button>
        <button
          type="button"
          className={activePanel === "modes" ? "panel-switcher__button is-active" : "panel-switcher__button"}
          onClick={() => setActivePanel("modes")}
        >
          모드
        </button>
      </div>

      {activePanel === "planner" ? (
      <section id="workspace" className="workspace">
        <div className="section-panel">
          {weather?.isRainy && (
            <div className="weather-banner">
              ☔ 오늘 서울 비 예보 — 실내 코스로 자동 최적화했어요
            </div>
          )}
          <div className="section-heading">
            <div>
              <p className="eyebrow">실시간 플래너</p>
              <h3>오늘 코스 조정</h3>
            </div>
            <div className="section-heading__meta">
              <span className={busy ? "live-pill live-pill--pending" : "live-pill"}>
                {busy ? "재계산 중" : "실시간 반영"}
              </span>
              {diagnostics ? (
                <span className="quality-pill">
                  {diagnostics.readyForLive
                    ? "실서비스 전환 준비 완료"
                    : diagnostics.place.configured || diagnostics.transit.configured
                      ? "실데이터 일부 연결"
                      : "현재 목업 데이터"}
                </span>
              ) : null}
              {errorMessage ? (
                <span className="error-pill" role="alert">
                  {errorMessage}
                </span>
              ) : null}
            </div>
          </div>

          <div className="workspace-switcher" role="tablist" aria-label="코스 작업 전환">
            <button
              type="button"
              className={
                activeWorkspacePanel === "recommend"
                  ? "workspace-switcher__button is-active"
                  : "workspace-switcher__button"
              }
              onClick={() => setActiveWorkspacePanel("recommend")}
            >
              추천
            </button>
            <button
              type="button"
              className={
                activeWorkspacePanel === "plan"
                  ? "workspace-switcher__button is-active"
                  : "workspace-switcher__button"
              }
              onClick={() => setActiveWorkspacePanel("plan")}
            >
              코스 편집
            </button>
            <button
              type="button"
              className={
                activeWorkspacePanel === "insights"
                  ? "workspace-switcher__button is-active"
                  : "workspace-switcher__button"
              }
              onClick={() => setActiveWorkspacePanel("insights")}
            >
              점수/대안
            </button>
          </div>

          <div className="workspace__grid" aria-busy={busy}>
            {activeWorkspacePanel === "recommend" ? (
            <article className="work-card work-card--recommendation">
              {mode === "p" && !chatCompleted ? (
                <div>
                  <div className="planner-top">
                    <div>
                      <p className="eyebrow">P 모드</p>
                      <h4>대화로 코스 만들기</h4>
                      <p className="subtle-text">
                        몇 가지 질문에 답하면 동선 최적화된 코스를 추천해드려요.
                      </p>
                    </div>
                    <button
                      type="button"
                      className="button button--ghost"
                      onClick={() => setChatCompleted(true)}
                    >
                      직접 설정하기
                    </button>
                  </div>
                  {!chatCompleted && (
                    <div className="quick-start-card">
                      <div className="quick-start-card__text">
                        <strong>지금 바로 시작</strong>
                        <span>질문 없이 지금 시간·분위기에 맞는 코스 바로 추천</span>
                      </div>
                      <button className="quick-start-btn" onClick={handleQuickStart}>
                        바로 추천 →
                      </button>
                    </div>
                  )}
                  <ChatPlanner
                    onDone={(collected: ChatCollected, variants: PlanVariant[]) => {
                      setChatCompleted(true);
                      setPlanVariants(variants);
                      setDistrict(collected.district);
                      setSelectedCategories(collected.categories);
                      setPreferences({
                        ...preferences,
                        budgetCap: collected.budgetCap,
                        vibePreference: collected.vibe,
                      });
                      setActiveWorkspacePanel("plan");
                    }}
                  />
                </div>
              ) : (
              <>
              <div className="planner-top">
                <div>
                  <p className="eyebrow">추천 엔진</p>
                  <h4>추천 패널</h4>
                  <p className="subtle-text">
                    지역과 활동 조합을 바꾸면 추천과 대안 후보를 바로 다시 계산합니다.
                  </p>
                  {diagnostics ? (
                    <div className="status-row">
                      <span className="status-pill">
                        장소: {diagnostics.place.provider}
                        {diagnostics.place.configured ? " 실데이터" : " 목업"}
                      </span>
                      <span className="status-pill">
                        교통: {diagnostics.transit.provider}
                        {diagnostics.transit.configured ? " 실데이터" : " 목업"}
                      </span>
                      <span className="status-pill">
                        리뷰: {diagnostics.review.provider}
                        {diagnostics.review.configured ? " 실데이터" : " 목업"}
                      </span>
                    </div>
                  ) : null}
                  {diagnostics?.issues.length ? (
                    <div className="setup-panel">
                      <strong>실서비스 연결 전 체크</strong>
                      <ul className="bullet-list">
                        {diagnostics.issues.map((issue) => (
                          <li key={issue}>{issue}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </div>
                <button
                  type="button"
                  className="button button--ghost"
                  onClick={() =>
                    loadRecommendation(
                      district,
                      selectedCategories,
                      preferences,
                      originLabel,
                      selectedCandidateIds
                    )
                  }
                  disabled={isRecommendationLoading || selectedCategories.length === 0}
                >
                  {isRecommendationLoading ? "추천 계산 중" : "추천 다시 계산"}
                </button>
              </div>

              <div className="preset-strip" aria-label="빠른 시작 프리셋">
                {quickPlanPresets.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    className={
                      preset.district === district &&
                      preset.categories.every((category) => selectedCategories.includes(category))
                        ? "preset-card is-active"
                        : "preset-card"
                    }
                    onClick={() => applyQuickPreset(preset.id)}
                    disabled={busy || isRecommendationLoading}
                  >
                    <strong>{preset.label}</strong>
                    <span>{preset.description}</span>
                  </button>
                ))}
              </div>

              <div className="composer-rail" aria-label="현재 입력 요약">
                <div className="composer-rail__item">
                  <span>1</span>
                  <div>
                    <strong>{district}</strong>
                    <small>지역 선택</small>
                  </div>
                </div>
                <div className="composer-rail__item">
                  <span>2</span>
                  <div>
                    <strong>
                      {selectedCategories.length > 0
                        ? selectedCategories.map(getCategoryLabel).join(" · ")
                        : "활동 선택 필요"}
                    </strong>
                    <small>활동 조합</small>
                  </div>
                </div>
                <div className="composer-rail__item">
                  <span>3</span>
                  <div>
                    <strong>{getVibeLabel(preferences.vibePreference)}</strong>
                    <small>
                      {getWalkLabel(preferences.walkPreference)}
                      {preferences.indoorPriority ? " · 실내 우선" : ""}
                    </small>
                  </div>
                </div>
              </div>

              <div className="control-stack">
                <div className="control-group">
                  <span>출발 위치</span>
                  <input
                    className="text-input"
                    value={originLabel}
                    onChange={(event) => setOriginLabel(event.target.value)}
                    placeholder="예: 성수역 3번 출구"
                    disabled={isRecommendationLoading}
                  />
                </div>
                <div className="control-group">
                  <span>출발 시간</span>
                  <TimePicker
                    value={startTime}
                    onChange={setStartTime}
                    disabled={isRecommendationLoading}
                  />
                </div>
                <div className="control-group">
                  <span>
                    지역
                    {weather && !weather.isRainy && (
                      <span className="weather-chip">
                        {weather.condition === "clear" ? "☀️" : "⛅"} {weather.temperatureCelsius}°C
                      </span>
                    )}
                  </span>
                  <div className="choice-row">
                    {districtChoices.map((choice) => (
                      <button
                        key={choice}
                        type="button"
                        title={DISTRICT_HINTS[choice]}
                        className={district === choice ? "choice-chip is-active" : "choice-chip"}
                        onClick={() => {
                          setSelectedCandidateIds([]);
                          setDistrict(choice);
                        }}
                        disabled={isRecommendationLoading}
                      >
                        {choice}
                      </button>
                    ))}
                  </div>
                  {district && DISTRICT_HINTS[district] && (
                    <p className="district-hint">{DISTRICT_HINTS[district]}</p>
                  )}
                </div>

                <div className="control-group">
                  <span>활동 조합</span>
                  <div className="choice-row">
                    {categoryChoices.map((choice) => (
                      <button
                        key={choice.value}
                        type="button"
                        className={
                          selectedCategories.includes(choice.value)
                            ? "choice-chip is-active"
                            : "choice-chip"
                        }
                        onClick={() => toggleCategory(choice.value)}
                        disabled={isRecommendationLoading}
                      >
                        {choice.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <VenueInputForm onAdd={handleAddCustomVenue} />
              {customVenues.length > 0 ? (
                <div className="custom-venues-list">
                  <p className="eyebrow">직접 추가한 장소</p>
                  {customVenues.map((v) => (
                    <div key={v.id} className="custom-venue-item">
                      <span>{v.name}</span>
                      <span className="token token--muted">{v.category}</span>
                      <button
                        type="button"
                        className="button button--ghost"
                        style={{ fontSize: "0.74rem", padding: "2px 8px" }}
                        onClick={() => {
                          setCustomVenues((prev) => prev.filter((c) => c.id !== v.id));
                          setSelectedCandidateIds((prev) => prev.filter((id) => id !== v.id));
                        }}
                      >
                        제거
                      </button>
                    </div>
                  ))}
                </div>
              ) : null}

              <div className="action-row">
                <button
                  type="button"
                  className="button button--primary"
                  onClick={() =>
                    applyCustomPlan({
                      district,
                      originLabel,
                      categories: selectedCategories,
                      preferences,
                      mode,
                      selectedCandidateIds,
                    })
                  }
                  disabled={busy || isRecommendationLoading || selectedCategories.length === 0}
                >
                  이 추천으로 플래너 만들기
                </button>
                <button type="button" className="button button--ghost" onClick={shareCurrentPlan}>
                  현재 상태 공유
                </button>
                {shareUrl ? (
                  <KakaoShareButton
                    title={`${planner.label} 코스`}
                    description={planner.steps.map((s) => s.title).join(" → ")}
                    url={shareUrl}
                    surpriseMode={surpriseMode}
                  />
                ) : null}
                <label className="surprise-toggle">
                  <input type="checkbox" checked={surpriseMode} onChange={e => setSurpriseMode(e.target.checked)} />
                  <span>🎁 서프라이즈 모드 (점수·분석 숨김)</span>
                </label>
              </div>
              <p className="inline-hint">
                지역, 활동, 취향을 바꾸면 추천이 자동으로 다시 계산됩니다.
              </p>
              {shareMessage ? <p className="subtle-text">{shareMessage}</p> : null}

              {recommendationError ? <p className="error-text">{recommendationError}</p> : null}

              {isRecommendationLoading && !recommendation ? (
                <RecommendationSkeleton />
              ) : null}

              {recommendation ? (
                <div className="recommendation-panel">
                  {(() => {
                    const diff = (preferences?.budgetCap ?? 80000) - (recommendation?.totalEstimatedCost ?? 0);
                    const isOver = diff < 0;
                    const perPerson = Math.round((recommendation?.totalEstimatedCost ?? 0) / 2);
                    return (
                      <div className={`budget-status ${isOver ? "budget-status--over" : "budget-status--ok"}`}>
                        <span className="budget-status__split">1인 약 {perPerson.toLocaleString("ko-KR")}원</span>
                        <span className="budget-status__diff">
                          {isOver
                            ? `예산 ${Math.abs(diff).toLocaleString("ko-KR")}원 초과`
                            : `예산 ${diff.toLocaleString("ko-KR")}원 여유`
                          }
                        </span>
                      </div>
                    );
                  })()}
                  <button
                    className={`rain-mode-btn${rainMode ? ' rain-mode-btn--active' : ''}`}
                    onClick={() => setRainMode(r => !r)}
                  >
                    {rainMode ? '☔ 우천 모드 ON' : '☔ 우천 모드'}
                  </button>
                  <div className="recommendation-summary">
                    <div>
                      <span>추천 라벨</span>
                      <strong>{recommendation.routeLabel}</strong>
                    </div>
                    <div>
                      <span>출발 기준</span>
                      <strong>{recommendation.timeSummary.startLabel}</strong>
                    </div>
                    <div>
                      <span>데이터 소스</span>
                      <strong>{recommendation.providerLabel}</strong>
                    </div>
                    <div>
                      <span>총 이동</span>
                      <strong>{recommendation.totalTravelMinutes}분</strong>
                    </div>
                    <div>
                      <span>예상 비용</span>
                      <strong>{recommendation.totalEstimatedCost.toLocaleString("ko-KR")}원</strong>
                    </div>
                    <div>
                      <span>캐시 상태</span>
                      <strong>
                        {recommendation.cache.hit ? `${recommendation.cache.source} 캐시` : "실시간 계산"}
                      </strong>
                    </div>
                    <div>
                      <span>시간대 판단</span>
                      <strong>{recommendation.timeSummary.peakRiskLabel}</strong>
                    </div>
                  </div>
                  <div className="alert-grid" aria-label="추천 진단">
                    {recommendation.alerts.map((alert) => (
                      <article
                        key={alert.id}
                        className={
                          alert.tone === "good" ? "alert-card alert-card--good" : "alert-card"
                        }
                      >
                        <strong>{alert.title}</strong>
                        <p>{alert.detail}</p>
                      </article>
                    ))}
                  </div>
                  <p className="subtle-text">{recommendation.explanation}</p>
                  <div className="status-row">
                    {recommendation.providers.map((provider) => (
                      <span
                        key={`${provider.stage}-${provider.activeProvider}`}
                        className={
                          provider.mode === "live"
                            ? "status-pill status-pill--live"
                            : provider.mode === "fallback"
                              ? "status-pill status-pill--fallback"
                              : "status-pill"
                        }
                      >
                        {provider.stage}: {provider.message}
                      </span>
                    ))}
                  </div>
                  <div className="recommendation-grid">
                    {(rainMode
                      ? [...recommendation.candidates].sort((a, b) => (b.indoor ? 1 : 0) - (a.indoor ? 1 : 0))
                      : recommendation.candidates
                    ).map((candidate) => (
                      <article key={candidate.id} className="recommendation-card">
                        <p className="eyebrow">
                          {candidate.district} · {candidate.category}
                          {rainMode && !candidate.indoor && (
                            <span className="venue-outdoor-warning">야외 ⚠️</span>
                          )}
                        </p>
                        <h5>{candidate.name}</h5>
                        <p className="subtle-text">{candidate.description}</p>
                        {candidate.reviewSummary ? (
                          <div className="review-box">
                            <strong>
                              리뷰 {candidate.reviewSummary.score.toFixed(1)} ·{" "}
                              {candidate.reviewSummary.confidence}
                            </strong>
                            <p>{candidate.reviewSummary.summary}</p>
                          </div>
                        ) : null}
                        {candidate.timing ? (
                          <div className="timing-box">
                            <strong>
                              {candidate.timing.arrivalLabel} · {candidate.timing.crowdLabel}
                              {candidate.timing.estimatedWaitMinutes > 0
                                ? ` · 예상 대기 ${candidate.timing.estimatedWaitMinutes}분`
                                : ""}
                            </strong>
                            <p>{candidate.timing.note}</p>
                          </div>
                        ) : null}
                        {candidate.alternativeSuggestion ? (
                          <div className="alternative-box">
                            <strong>{candidate.alternativeSuggestion.name}</strong>
                            <p>{candidate.alternativeSuggestion.reason}</p>
                            <span>{candidate.alternativeSuggestion.detail}</span>
                            <button
                              type="button"
                              className="inline-action"
                              onClick={() =>
                                applyCandidateAlternative(
                                  candidate.id,
                                  candidate.alternativeSuggestion!.candidateId
                                )
                              }
                              disabled={isRecommendationLoading || busy}
                            >
                              {selectedCandidateIds.includes(
                                candidate.alternativeSuggestion.candidateId
                              )
                                ? "대안 반영됨"
                                : "이 대안으로 다시 계산"}
                            </button>
                          </div>
                        ) : null}
                        {candidate.fitBadges?.length ? (
                          <div className="fit-badge-row">
                            {candidate.fitBadges.map((badge) => (
                              <span
                                key={`${candidate.id}-${badge.label}`}
                                className={
                                  badge.tone === "good"
                                    ? "fit-badge fit-badge--good"
                                    : badge.tone === "caution"
                                      ? "fit-badge fit-badge--caution"
                                      : "fit-badge"
                                }
                              >
                                {badge.label}
                              </span>
                            ))}
                          </div>
                        ) : null}
                        <div className="token-row token-row--dense">
                          {candidate.tags.map((tag) => (
                            <span key={tag} className="token">
                              {tag}
                            </span>
                          ))}
                          {candidate.reviewSummary?.strengths.map((tag) => (
                            <span key={`${candidate.id}-${tag}`} className="token token--accent">
                              {tag}
                            </span>
                          ))}
                        </div>
                        <div className="recommendation-meta">
                          <span>
                            {candidate.transitMode} {candidate.travelMinutes}분
                          </span>
                          <span>
                            {candidate.estimatedCost.toLocaleString("ko-KR")}원 · {candidate.source}
                          </span>
                        </div>
                      </article>
                    ))}
                  </div>
                </div>
              ) : null}
              </>
              )}
            </article>
            ) : null}

            {activeWorkspacePanel === "plan" ? (
            <section className="workspace__main">
            <div className="scenario-strip" aria-label="데이트 시나리오 선택">
              {scenarios.map((scenario) => (
                <button
                  key={scenario.id}
                  type="button"
                  className={scenario.id === planner.id ? "scenario-card is-active" : "scenario-card"}
                  onClick={() => handleScenarioChange(scenario.id)}
                  aria-pressed={scenario.id === planner.id}
                  disabled={busy}
                >
                  <span>{scenario.label}</span>
                  <strong>{scenario.shortDescription}</strong>
                  <small>{scenario.emphasis}</small>
                </button>
              ))}
            </div>

            <article className="work-card work-card--planner">
              <div className="planner-top">
                <div>
                  <p className="eyebrow">{planner.banner}</p>
                  <h4>{planner.label}</h4>
                  <p className="subtle-text">{planner.intro}</p>
                </div>

                <div className="mode-toggle" aria-label="모드 선택">
                  <button
                    type="button"
                    className={mode === "p" ? "mode-toggle__button is-active" : "mode-toggle__button"}
                    onClick={() => handleModeChange("p")}
                    aria-pressed={mode === "p"}
                    disabled={busy}
                  >
                    P 모드
                  </button>
                  <button
                    type="button"
                    className={mode === "j" ? "mode-toggle__button is-active" : "mode-toggle__button"}
                    onClick={() => handleModeChange("j")}
                    aria-pressed={mode === "j"}
                    disabled={busy}
                  >
                    J 모드
                  </button>
                </div>
              </div>

              <div className="planner-brief">
                <strong>{mode === "p" ? "지금은 다음 한 단계에 집중하는 흐름입니다." : "지금은 전체 구조를 직접 편집하는 흐름입니다."}</strong>
                <span>
                  {planner.startLabel} 출발 · {planner.steps.length}개 스텝 · {planner.totalTransferLabel}
                </span>
              </div>

              <div className="summary-row">
                <div>
                  <span>출발</span>
                  <strong>{planner.startLabel}</strong>
                </div>
                <div>
                  <span>총 이동</span>
                  <strong>{planner.totalTransferLabel}</strong>
                </div>
                <div>
                  <span>예산 캡</span>
                  <strong>{planner.budgetLabel}</strong>
                </div>
                <div>
                  <span>맞춤 조건</span>
                  <strong>{planner.preferenceSummary}</strong>
                </div>
                <div>
                  <span>저장 방식</span>
                  <strong>{storageSource === "supabase" ? "Supabase 연결" : "로컬 저장"}</strong>
                </div>
              </div>

              {routeOptimization && !routeOptimization.isAlreadyOptimal && mode === "j" ? (
                <div className="route-optimization-banner">
                  <div>
                    <strong>동선 최적화 가능</strong>
                    <span>
                      순서를 바꾸면 약 {routeOptimization.savingMinutes}분 단축돼요
                      ({routeOptimization.optimalOrder.map((v) => v.name).join(" → ")})
                    </span>
                  </div>
                  <button
                    type="button"
                    className="button button--soft"
                    onClick={() => {
                      if (!routeOptimization) return;
                      const optimalIds = routeOptimization.optimalOrder.map((v) => v.id);
                      void applyCustomPlan({
                        district,
                        originLabel,
                        categories: selectedCategories,
                        preferences,
                        mode,
                        selectedCandidateIds: optimalIds,
                      });
                      setRouteOptimization((prev) =>
                        prev ? { ...prev, isAlreadyOptimal: true } : null
                      );
                    }}
                    disabled={busy}
                  >
                    최적 순서 적용
                  </button>
                </div>
              ) : null}

              {courseProgress ? (
                <CourseProgress
                  steps={planner.steps}
                  progress={courseProgress}
                  onCheckIn={(stepId) => {
                    setCourseProgress((prev) =>
                      prev
                        ? {
                            ...prev,
                            checkedInAt: { ...prev.checkedInAt, [stepId]: new Date().toISOString() },
                          }
                        : null
                    );
                  }}
                  onNext={() => {
                    setCourseProgress((prev) =>
                      prev ? { ...prev, currentStepIndex: prev.currentStepIndex + 1 } : null
                    );
                  }}
                  onEnd={() => setCourseProgress(null)}
                />
              ) : (
                <button
                  type="button"
                  className="button button--soft course-start-btn"
                  onClick={() =>
                    setCourseProgress({
                      active: true,
                      currentStepIndex: 0,
                      checkedInAt: {},
                    })
                  }
                >
                  오늘 데이트 시작
                </button>
              )}

              <button
                type="button"
                className="timeline-toggle-btn"
                onClick={() => setShowTimeline((t) => !t)}
              >
                {showTimeline ? "목록 보기" : "⏱ 타임라인 보기"}
              </button>
              {showTimeline && recommendation && (
                <PlanTimeline
                  stops={buildTimelineStops(
                    recommendation.candidates.map((c) => ({
                      id: c.id,
                      name: c.name,
                      category: c.category,
                      stayMinutes: c.stayMinutes,
                      travelMinutes: c.travelMinutes,
                      transitMode: c.transitMode,
                    })),
                    startTime ?? "19:00"
                  )}
                />
              )}
              <div className="step-list">
                {planner.steps.map((step, index) => {
                  const stepAlts = recommendation?.candidates.filter(
                    (c) => {
                      const catLabel = getCategoryLabel(c.category);
                      return catLabel === step.category && c.name !== step.title;
                    }
                  ).slice(0, 3) ?? [];
                  const isAltExpanded = expandedAltStepId === step.id;

                  return (
                  <article key={step.id} className="step-card">
                    <div className="step-card__index">{index + 1}</div>
                    <div className="step-card__body">
                      <div className="step-card__header">
                        <div>
                          <p className="step-card__meta">
                            {step.category} · {step.transferLabel}
                          </p>
                          <h5>{step.title}</h5>
                        </div>
                        <strong className="step-card__price">{step.priceLabel}</strong>
                      </div>

                      <p className="step-card__slot">
                        {step.slot} · 체류 {step.stayLabel}
                      </p>
                      <p className="step-card__description">{step.description}</p>

                      <div className="token-row token-row--dense">
                        {step.tags.map((tag) => (
                          <span key={tag} className="token token--muted">
                            {tag}
                          </span>
                        ))}
                      </div>

                      {stepAlts.length > 0 ? (
                        <div className="step-alts">
                          <button
                            type="button"
                            className="step-alts__toggle"
                            onClick={() =>
                              setExpandedAltStepId(isAltExpanded ? null : step.id)
                            }
                          >
                            {isAltExpanded ? "대안 닫기" : `대안 ${stepAlts.length}개 보기`}
                          </button>
                          {isAltExpanded ? (
                            <div className="step-alts__list">
                              {stepAlts.map((alt) => (
                                <div key={alt.id} className="step-alt-item">
                                  <div className="step-alt-item__info">
                                    <strong>{alt.name}</strong>
                                    <span>
                                      {alt.travelMinutes}분 · {alt.estimatedCost.toLocaleString("ko-KR")}원
                                    </span>
                                    <p>{alt.concept}</p>
                                  </div>
                                  <button
                                    type="button"
                                    className="button button--soft"
                                    disabled={busy}
                                    onClick={() => {
                                      const currentId = selectedCandidateIds.find((id) =>
                                        recommendation?.candidates.some(
                                          (c) => c.id === id && getCategoryLabel(c.category) === step.category
                                        )
                                      );
                                      applyCandidateAlternative(currentId ?? "", alt.id);
                                    }}
                                  >
                                    교체
                                  </button>
                                </div>
                              ))}
                            </div>
                          ) : null}
                        </div>
                      ) : null}
                    </div>

                    <div className="step-card__actions">
                      <button
                        type="button"
                        className="icon-button"
                        onClick={() => moveStep(step.id, "up")}
                        disabled={index === 0 || busy || mode === "p"}
                        aria-label={`${step.title} 위로 이동`}
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        className="icon-button"
                        onClick={() => moveStep(step.id, "down")}
                        disabled={index === planner.steps.length - 1 || busy || mode === "p"}
                        aria-label={`${step.title} 아래로 이동`}
                      >
                        ↓
                      </button>
                    </div>
                  </article>
                  );
                })}
              </div>

              {mode === "p" && planVariants.length > 0 ? (
                <div className="plan-variant-section">
                  <p className="eyebrow">다른 코스 옵션</p>
                  <div className="plan-variant-list">
                    {planVariants.map((variant) => (
                      <button
                        key={variant.theme}
                        type="button"
                        className="plan-variant-card"
                        disabled={busy}
                        onClick={() =>
                          applyCustomPlan({
                            district,
                            originLabel,
                            categories: selectedCategories,
                            preferences,
                            mode,
                            selectedCandidateIds: variant.candidates.map((c) => c.id),
                          })
                        }
                      >
                        <div className="plan-variant-card__label">{variant.label}</div>
                        <div className="plan-variant-card__tagline">{variant.tagline}</div>
                        <div className="plan-variant-card__meta">
                          {variant.candidates.map((c) => c.name).join(" → ")}
                        </div>
                        <div className="plan-variant-card__stats">
                          {Math.round(variant.totalMinutes / 60)}시간 · {variant.totalCost.toLocaleString("ko-KR")}원
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
            </article>
            </section>
            ) : null}

            {activeWorkspacePanel === "insights" ? (
            <aside className="workspace__side workspace__side--full">
              <article className="work-card">
              <div className="score-head">
                <div>
                  <p className="eyebrow">코스 완성도</p>
                  <h4>{planner.scores.overall}점</h4>
                </div>
                <span className="quality-pill">{planner.scoreLabel}</span>
              </div>

              <div className="score-grid">
                <div>
                  <span>이동 효율</span>
                  <strong>{planner.scores.mobility}</strong>
                </div>
                <div>
                  <span>무드 일관성</span>
                  <strong>{planner.scores.mood}</strong>
                </div>
                <div>
                  <span>예산 적합성</span>
                  <strong>{planner.scores.budget}</strong>
                </div>
                <div>
                  <span>접근성</span>
                  <strong>{planner.scores.accessibility}</strong>
                </div>
              </div>
            </article>

              <article className="work-card work-card--accent">
              <p className="eyebrow">대안 추천</p>
              <h4>{planner.altPanel.title}</h4>
              <p className="subtle-text">{planner.altPanel.copy}</p>

              <div className="alt-panel">
                <div>
                  <strong>{planner.altPanel.name}</strong>
                  <p>{planner.altPanel.meta}</p>
                </div>
                <button
                  type="button"
                  className="button button--soft"
                  onClick={swapAlternative}
                  disabled={!planner.altPanel.canSwap || planner.altPanel.swapped || busy}
                >
                  {planner.altPanel.swapped ? "교체 완료" : "이 대안 적용"}
                </button>
              </div>
            </article>

              <article className="work-card">
              <p className="eyebrow">추천 근거</p>
              <h4>추천 이유</h4>
              <p className="subtle-text">{planner.reason}</p>
              </article>
            </aside>
            ) : null}
          </div>
        </div>
      </section>
      ) : null}

      {activePanel === "profile" ? (
      <section id="personalize" className="profile-zone">
        <div className="section-panel">
          <div className="section-heading">
            <div>
              <p className="eyebrow">취향 프로필</p>
              <h3>취향은 짧게 입력</h3>
            </div>
          </div>

          <div className="profile-zone__grid">
            <article className="profile-card profile-card--identity">
            <p className="eyebrow">오늘의 취향</p>
            <h4>{planner.profile.headline}</h4>
            <p className="subtle-text">{planner.profile.description}</p>
            <div className="token-row">
              {planner.profile.tags.map((tag) => (
                <span key={tag} className="token token--accent">
                  {tag}
                </span>
              ))}
            </div>
          </article>

            <article className="profile-card">
            <p className="eyebrow">취향 조정</p>
            <h4>오늘 기준만 빠르게 조정</h4>
            <div className="control-stack">
              <div className="control-group">
                <span>예산</span>
                <div className="choice-row">
                  {budgetChoices.map((choice) => (
                    <button
                      key={choice}
                      type="button"
                      className={
                        preferences.budgetCap === choice ? "choice-chip is-active" : "choice-chip"
                      }
                      onClick={() => updatePreferences({ ...preferences, budgetCap: choice })}
                      disabled={busy}
                    >
                      {choice.toLocaleString("ko-KR")}원
                    </button>
                  ))}
                </div>
              </div>

              <div className="control-group">
                <span>도보 허용도</span>
                <div className="choice-row">
                  {walkChoices.map((choice) => (
                    <button
                      key={choice.value}
                      type="button"
                      className={
                        preferences.walkPreference === choice.value
                          ? "choice-chip is-active"
                          : "choice-chip"
                      }
                      onClick={() =>
                        updatePreferences({ ...preferences, walkPreference: choice.value })
                      }
                      disabled={busy}
                    >
                      {choice.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="control-group">
                <span>무드 선호</span>
                <div className="choice-row">
                  {vibeChoices.map((choice) => (
                    <button
                      key={choice.value}
                      type="button"
                      className={
                        preferences.vibePreference === choice.value
                          ? "choice-chip is-active"
                          : "choice-chip"
                      }
                      onClick={() =>
                        updatePreferences({ ...preferences, vibePreference: choice.value })
                      }
                      disabled={busy}
                    >
                      {choice.label}
                    </button>
                  ))}
                </div>
              </div>

              <button
                type="button"
                className={preferences.indoorPriority ? "toggle-card is-active" : "toggle-card"}
                onClick={() =>
                  updatePreferences({
                    ...preferences,
                    indoorPriority: !preferences.indoorPriority,
                  })
                }
                disabled={busy}
                aria-pressed={preferences.indoorPriority}
              >
                <span>실내 우선</span>
                <strong>{preferences.indoorPriority ? "켜짐" : "꺼짐"}</strong>
              </button>
            </div>
          </article>

            <article className="profile-card">
            <p className="eyebrow">모드 설명</p>
            <h4>{mode === "p" ? "즉흥형을 위한 안내형 UX" : "통제형을 위한 편집형 UX"}</h4>
            <ul className="bullet-list">
              {(mode === "p" ? planner.modeNotes.p : planner.modeNotes.j).map((note) => (
                <li key={note}>{note}</li>
              ))}
            </ul>
          </article>

            <article className="profile-card profile-card--wide">
            <div className="profile-wide__header">
              <div>
                <p className="eyebrow">저장된 코스</p>
                <h4>마음에 드는 코스를 저장해 다시 불러오기</h4>
              </div>
              <button type="button" className="button button--primary" onClick={saveCurrentPlan}>
                현재 코스 저장
              </button>
            </div>
            <div className="saved-grid">
              {savedPlans.length === 0 ? (
                <div className="empty-card">
                  <strong>아직 저장된 코스가 없습니다</strong>
                  <span>현재 추천이 마음에 들면 저장해 두고 나중에 다시 불러올 수 있습니다.</span>
                </div>
              ) : (
                savedPlans.map((savedPlan) => (
                  <button
                    key={savedPlan.id}
                    type="button"
                    className="saved-card"
                    onClick={() => restoreSavedPlan(savedPlan)}
                    disabled={busy}
                  >
                    <span>{savedPlan.label}</span>
                    <strong>{savedPlan.score}점</strong>
                    <small>
                      {savedPlan.swapAlternative ? "대안 반영" : "기본 코스"} ·{" "}
                      {savedPlan.preferences.vibePreference === "quiet"
                        ? "조용한 무드"
                        : savedPlan.preferences.vibePreference === "cinematic"
                          ? "무드 우선"
                          : "가벼운 템포"}
                    </small>
                    <small>{new Date(savedPlan.savedAt).toLocaleString("ko-KR")}</small>
                  </button>
                ))
              )}
            </div>
            <div className="comfort-grid">
              <div>
                <strong>큰 터치 영역</strong>
                <span>모바일에서도 누르기 쉬운 버튼과 카드 간격</span>
              </div>
              <div>
                <strong>높은 대비</strong>
                <span>크림 배경과 짙은 텍스트로 가독성 확보</span>
              </div>
              <div>
                <strong>과하지 않은 모션</strong>
                <span>판단을 방해하지 않는 수준으로만 애니메이션 적용</span>
              </div>
            </div>
            </article>
          </div>
        </div>
      </section>
      ) : null}

      {activePanel === "modes" ? (
      <section id="modes" className="modes">
        <div className="section-panel">
          <div className="section-heading">
            <div>
              <p className="eyebrow">모드 안내</p>
              <h3>P / J 모드</h3>
            </div>
          </div>

          <div className="modes__grid">
            <article className={mode === "p" ? "mode-card is-active" : "mode-card"}>
            <div className="card-header">
              <span>P 모드</span>
              <span>상황 대응</span>
            </div>
            <h4>복잡한 계획보다 다음 한 단계에 집중</h4>
            <p className="subtle-text">
              웨이팅, 날씨, 막차처럼 계획을 깨는 변수가 생길 때 강합니다. 앱이 먼저 다음 이동을
              제안합니다.
            </p>
          </article>

            <article className={mode === "j" ? "mode-card is-active" : "mode-card"}>
            <div className="card-header">
              <span>J 모드</span>
              <span>정밀 조정</span>
            </div>
            <h4>순서와 구조를 눈으로 보면서 바로 수정</h4>
            <p className="subtle-text">
              사용자가 전체를 통제하고 시스템은 이동 시간과 완성도를 재계산합니다. 저장과 공유로
              확장하기 좋은 형태입니다.
            </p>
            </article>
          </div>
        </div>
      </section>
      ) : null}
    </main>
    </>
  );
}
