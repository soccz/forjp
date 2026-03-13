import type { ProviderStatus, ReviewSummary, VenueCandidate } from "@/lib/types";
import { getRuntimeDiagnostics } from "@/lib/runtime-config";
import { getStoredReviewSummary } from "@/lib/review-store";

export type ReviewProvider = {
  label: string;
  isLive: boolean;
  summarize(candidate: VenueCandidate): Promise<{ summary: ReviewSummary; status: ProviderStatus }>;
};

function buildMockSummary(candidate: VenueCandidate): ReviewSummary {
  const quietBonus = candidate.quietScore * 0.45;
  const visualBonus = candidate.visualScore * 0.35;
  const indoorBonus = candidate.indoor ? 0.3 : 0;
  const rawScore = 3 + quietBonus + visualBonus + indoorBonus;
  const score = Math.min(4.9, Number(rawScore.toFixed(1)));

  return {
    source: candidate.source === "kakao" ? "composite" : "mock",
    score,
    confidence: candidate.source === "kakao" ? "medium" : "low",
    summary:
      candidate.quietScore >= 4
        ? "대화 만족도와 체류 안정성이 높은 편입니다."
        : "가볍게 머무르기 좋지만 시간대에 따라 체감이 달라질 수 있습니다.",
    strengths: [
      candidate.tags[0] ?? "분위기",
      candidate.indoor ? "실내 동선 안정" : "분위기 전환",
      candidate.visualScore >= 4 ? "무드 연출 강점" : "부담 없는 선택",
    ],
    cautions:
      candidate.transitMode === "taxi"
        ? ["교통비 변동 가능", "피크 시간대 이동 편차"]
        : candidate.quietScore < 4
          ? ["시간대별 소음 편차", "좌석 상황 확인 권장"]
          : ["혼잡 시간대 체크 권장"],
  };
}

class MockReviewProvider implements ReviewProvider {
  label = "Mock reviews";
  isLive = false;

  async summarize(
    candidate: VenueCandidate
  ): Promise<{ summary: ReviewSummary; status: ProviderStatus }> {
    return {
      summary: buildMockSummary(candidate),
      status: {
        stage: "review",
        activeProvider: "Mock reviews",
        mode: "mock",
        message: "리뷰 요약은 현재 목업 계층을 사용 중입니다.",
      },
    };
  }
}

class SupabaseReviewProvider implements ReviewProvider {
  label = "Supabase review summaries";
  isLive = true;

  async summarize(
    candidate: VenueCandidate
  ): Promise<{ summary: ReviewSummary; status: ProviderStatus }> {
    const storedSummary = await getStoredReviewSummary(candidate);

    if (!storedSummary) {
      return {
        summary: buildMockSummary(candidate),
        status: {
          stage: "review",
          activeProvider: "Supabase review summaries",
          mode: "fallback",
          message: "저장된 리뷰 요약이 없어 목업 리뷰 요약으로 fallback했습니다.",
        },
      };
    }

    return {
      summary: {
        ...storedSummary.summary,
        source: "supabase",
      },
      status: {
        stage: "review",
        activeProvider: "Supabase review summaries",
        mode: "live",
        message: "저장된 리뷰 요약을 반영했습니다.",
      },
    };
  }
}

export function resolveReviewProvider() {
  if (getRuntimeDiagnostics().review.configured) {
    return new SupabaseReviewProvider();
  }

  return new MockReviewProvider();
}

export function getReviewProviderDiagnostics() {
  return getRuntimeDiagnostics().review;
}
