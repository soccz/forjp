# COUPLE

서울 데이트 코스 플래너 웹앱입니다.
AI 채팅으로 취향을 수집하고, 5가지 테마 코스를 추천하며, 파트너와 공유하고 함께 투표할 수 있습니다.

## 주요 기능

- **P mode**: AI 채팅 플로우로 지역·시간·분위기·예산 수집 → 5가지 테마 코스 생성
- **J mode**: 고정 시나리오 기반 플래너 (퇴근 후, 기념일, 우천, 소개팅)
- **코스 테마**: 효율 / 무드 / 여유 / 로맨틱 / 발견 5종
- **경로 최적화**: Haversine 기반 최단 동선 자동 계산
- **날씨 감지**: 비 오는 날 실내 장소 자동 우선 추천
- **타임라인**: 코스 전체 시간 흐름 시각화
- **서프라이즈 모드**: 파트너에게 플랜 내용 숨김 공유
- **파트너 투표**: 공유 링크로 각 코스 단계별 love / okay / skip 투표
- **데이트 회고**: 코스 진행 중 체크인 및 완료 후 별점 기록
- **장소 직접 추가**: 커스텀 장소를 코스에 삽입
- **빠른 추천**: 현재 시간 기반 즉시 코스 생성
- **가성비 점수**: 체류 시간 대비 비용으로 장소별 밀도 계산

## 실행

```bash
npm install
npm run dev
```

프로덕션 빌드:

```bash
npm run build
npm run start
```

## 환경 변수

`.env.example` 기준으로 `.env.local`을 작성합니다.

```
# 장소 검색 실데이터 (없으면 mock fallback)
KAKAO_REST_API_KEY=

# 대중교통 경로 계산 실데이터 (없으면 mock fallback)
ODSAY_API_KEY=

# 저장·캐시·공유 계층 (없으면 로컬 저장 fallback)
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# NextAuth (필수)
NEXTAUTH_SECRET=
NEXTAUTH_URL=http://localhost:3000

# 카카오 소셜 로그인 (선택)
KAKAO_CLIENT_ID=
KAKAO_CLIENT_SECRET=
NEXT_PUBLIC_KAKAO_AUTH_ENABLED=false

# 카카오 공유 SDK (선택)
NEXT_PUBLIC_KAKAO_JS_KEY=

# AI 채팅 (없으면 mock provider)
ANTHROPIC_API_KEY=
```

환경 변수 없이도 앱은 mock provider + 로컬 저장으로 전부 동작합니다.

## Supabase 설정

저장·캐시·공유 기능을 활성화하려면 [supabase/schema.sql](supabase/schema.sql)을 Supabase 프로젝트에 적용합니다.

적용 테이블:

- `saved_plans` — 코스 저장
- `api_cache` — 추천 결과 캐시 (30분)
- `place_review_summaries` — 장소 리뷰 요약
- `shared_plans` — 파트너 공유 및 투표

## API

| 엔드포인트 | 설명 |
|---|---|
| `GET /api/health` | 환경 설정 상태 및 실서비스 전환 가능 여부 |
| `GET /api/diagnostics` | provider 상태 상세 |
| `POST /api/chat` | AI 채팅 플로우 (단계별 취향 수집) |
| `POST /api/recommendations` | 장소 추천 후보 목록 반환 |
| `POST /api/custom-plan` | 커스텀 추천 → 플래너 구조 변환 |
| `POST /api/planner` | 시나리오 기반 플래너 재계산 |
| `GET/POST /api/saved-plans` | 코스 저장 / 조회 |
| `GET/POST/PATCH /api/shared-plans` | 공유 링크 생성·조회·파트너 투표 |
| `GET /api/weather` | 서울 현재 날씨 (30분 캐시) |

## 현재 상태

| 기능 | 상태 |
|---|---|
| 장소 검색 | `KAKAO_REST_API_KEY` 설정 시 실데이터, 없으면 mock |
| 대중교통 | `ODSAY_API_KEY` 설정 시 실데이터, 없으면 mock |
| AI 채팅 | `ANTHROPIC_API_KEY` 설정 시 Claude, 없으면 mock |
| 날씨 | Open-Meteo 무료 API (항상 실데이터) |
| 리뷰 요약 | Supabase `place_review_summaries` 또는 mock |
| 저장·공유 | Supabase 설정 시 DB, 없으면 localStorage |
| 카카오 로그인 | `NEXT_PUBLIC_KAKAO_AUTH_ENABLED=true` + 키 설정 시 활성 |
