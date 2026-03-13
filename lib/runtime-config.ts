import type { ProviderDiagnostics } from "@/lib/types";

function hasValue(value: string | undefined) {
  return Boolean(value && value.trim().length > 0);
}

export function getRuntimeDiagnostics(): ProviderDiagnostics {
  const hasKakao = hasValue(process.env.KAKAO_REST_API_KEY);
  const hasOdsay = hasValue(process.env.ODSAY_API_KEY);
  const hasSupabaseUrl = hasValue(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const hasSupabaseAnon = hasValue(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  const hasSupabaseServiceRole = hasValue(process.env.SUPABASE_SERVICE_ROLE_KEY);
  const hasSupabase = hasSupabaseUrl && hasSupabaseAnon && hasSupabaseServiceRole;

  const issues: string[] = [];
  const setupSteps: string[] = [];

  if (!hasKakao) {
    issues.push("Kakao Local API 키가 없어 장소 검색은 현재 목업 provider를 사용합니다.");
    setupSteps.push("`KAKAO_REST_API_KEY`를 설정해 장소 검색을 실데이터로 전환하세요.");
  }

  if (!hasOdsay) {
    issues.push("ODsay API 키가 없어 대중교통 계산은 현재 목업 provider를 사용합니다.");
    setupSteps.push("`ODSAY_API_KEY`를 설정해 대중교통 이동 시간을 실데이터로 전환하세요.");
  }

  if (!hasSupabase) {
    issues.push("Supabase 설정이 완전하지 않아 저장/캐시 계층은 로컬 중심으로 동작합니다.");
    setupSteps.push(
      "`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`를 모두 설정하세요."
    );
  }

  if (setupSteps.length === 0) {
    setupSteps.push("필수 환경 변수가 모두 설정되어 있습니다. 실데이터 provider 상태를 실제 응답으로 점검하세요.");
  }

  return {
    readyForLive: hasKakao && hasOdsay && hasSupabase,
    place: {
      configured: hasKakao,
      provider: hasKakao ? "Kakao Local + quality filters" : "Mock places",
    },
    transit: {
      configured: hasOdsay,
      provider: hasOdsay ? "ODsay transit" : "Mock transit",
    },
    review: {
      configured: hasSupabase,
      provider: hasSupabase ? "Supabase review summaries" : "Mock reviews",
    },
    setupSteps,
    issues,
  };
}
