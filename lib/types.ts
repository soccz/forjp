export type PlannerMode = "p" | "j";
export type ScenarioId = "afterwork" | "anniversary" | "rainy" | "blind";
export type PlanId = ScenarioId | "custom";
export type WalkPreference = "easy" | "balanced" | "adventurous";
export type VibePreference = "quiet" | "cinematic" | "playful";
export type ActivityCategory = "movie" | "cafe" | "dinner" | "bar" | "gallery" | "walk";

export type UserPreferences = {
  budgetCap: number;
  walkPreference: WalkPreference;
  vibePreference: VibePreference;
  indoorPriority: boolean;
};

export type PlannerStep = {
  id: string;
  category: string;
  title: string;
  description: string;
  slot: string;
  stayMinutes: number;
  stayLabel: string;
  transferLabel: string;
  transferMinutes: number;
  priceValue: number;
  priceLabel: string;
  trustScore: number;
  walkIntensity: "low" | "medium" | "high";
  tags: string[];
};

export type PlannerScores = {
  overall: number;
  mobility: number;
  mood: number;
  budget: number;
  accessibility: number;
};

export type PlannerProfile = {
  headline: string;
  description: string;
  tags: string[];
};

export type PlannerAltPanel = {
  title: string;
  copy: string;
  name: string;
  meta: string;
  canSwap: boolean;
  swapped: boolean;
};

export type PlannerResult = {
  id: PlanId;
  mode: PlannerMode;
  label: string;
  banner: string;
  intro: string;
  startLabel: string;
  budgetLabel: string;
  durationLabel: string;
  totalCostLabel: string;
  totalTransferLabel: string;
  scoreLabel: string;
  reason: string;
  preferenceSummary: string;
  preferences: UserPreferences;
  profile: PlannerProfile;
  steps: PlannerStep[];
  scores: PlannerScores;
  altPanel: PlannerAltPanel;
  modeNotes: {
    p: string[];
    j: string[];
  };
};

export type ScenarioSummary = {
  id: ScenarioId;
  label: string;
  shortDescription: string;
  emphasis: string;
};

export type SavedPlan = {
  id: string;
  scenarioId: PlanId;
  label: string;
  mode: PlannerMode;
  score: number;
  savedAt: string;
  preferences: UserPreferences;
  stepIds: string[];
  swapAlternative: boolean;
  customConfig?: {
    district: string;
    originLabel: string;
    categories: ActivityCategory[];
    selectedCandidateIds?: string[];
  };
};

export type SavedPlansResponse = {
  plans: SavedPlan[];
  source: "supabase" | "local";
};

export type VenueCandidate = {
  id: string;
  name: string;
  category: ActivityCategory;
  district: string;
  concept: string;
  description: string;
  transitMode: "walk" | "bus" | "subway" | "taxi";
  travelMinutes: number;
  stayMinutes: number;
  estimatedCost: number;
  quietScore: number;
  visualScore: number;
  indoor: boolean;
  latitude: number;
  longitude: number;
  source: "mock" | "kakao";
  tags: string[];
  reviewSummary?: ReviewSummary;
  fitBadges?: RecommendationFitBadge[];
  timing?: RecommendationTiming;
  alternativeSuggestion?: RecommendationAlternative;
};

export type RecommendationRequest = {
  district: string;
  originLabel: string;
  categories: ActivityCategory[];
  preferences: UserPreferences;
  selectedCandidateIds?: string[];
};

export type RecommendationResponse = {
  provider: "mock" | "hybrid" | "live";
  providerLabel: string;
  providers: ProviderStatus[];
  routeLabel: string;
  timeSummary: RecommendationTimeSummary;
  totalTravelMinutes: number;
  totalEstimatedCost: number;
  explanation: string;
  alerts: RecommendationAlert[];
  candidates: VenueCandidate[];
  cache: {
    hit: boolean;
    source: "memory" | "supabase" | "none";
    key: string;
    ttlSeconds: number;
  };
};

export type CustomPlannerRequest = {
  district: string;
  originLabel: string;
  categories: ActivityCategory[];
  preferences: UserPreferences;
  mode: PlannerMode;
  selectedCandidateIds?: string[];
};

export type ReviewSummary = {
  source: "mock" | "composite" | "supabase";
  score: number;
  confidence: "low" | "medium" | "high";
  summary: string;
  strengths: string[];
  cautions: string[];
};

export type ReviewSummaryRecord = {
  venueKey: string;
  venueName: string;
  district: string;
  summary: ReviewSummary;
  updatedAt: string;
};

export type ProviderStatus = {
  stage: "place" | "transit" | "review";
  activeProvider: string;
  mode: "live" | "mock" | "fallback";
  message: string;
};

export type ProviderDiagnostics = {
  readyForLive: boolean;
  place: {
    configured: boolean;
    provider: string;
  };
  transit: {
    configured: boolean;
    provider: string;
  };
  review: {
    configured: boolean;
    provider: string;
  };
  setupSteps: string[];
  issues: string[];
};

export type RecommendationFitBadge = {
  label: string;
  tone: "good" | "neutral" | "caution";
};

export type RecommendationAlert = {
  id: string;
  title: string;
  detail: string;
  tone: "good" | "caution";
};

export type RecommendationTiming = {
  arrivalLabel: string;
  crowdLevel: "low" | "medium" | "high";
  crowdLabel: string;
  estimatedWaitMinutes: number;
  note: string;
};

export type RecommendationTimeSummary = {
  startLabel: string;
  peakRiskLabel: string;
  peakRiskTone: "good" | "caution";
};

export type RecommendationAlternative = {
  candidateId: string;
  name: string;
  detail: string;
  reason: string;
};

// Chat (P mode)
export type ChatMessage = {
  id: string;
  role: "ai" | "user";
  content: string;
};

export type ChatStep =
  | "greeting"
  | "district"
  | "time"
  | "vibe"
  | "budget"
  | "generating"
  | "done";

export type ChatCollected = {
  district: string;
  startTime: string;
  vibe: VibePreference;
  budgetCap: number;
  categories: ActivityCategory[];
};

// Plan variants (P mode results)
export type PlanVariantTheme = "efficient" | "mood" | "relaxed";

export type PlanVariant = {
  theme: PlanVariantTheme;
  label: string;
  tagline: string;
  candidates: VenueCandidate[];
  totalCost: number;
  totalMinutes: number;
};
