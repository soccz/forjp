# COUPLE

서울 기반 데이트 플래너 웹앱입니다.

AI 채팅으로 코스를 설계하는 **P mode**와 직접 장소를 고르는 **J mode**, 5가지 테마 플랜 변형, 동선 최적화, 코스 공유, 파트너 투표, 날씨 감지, 카카오 로그인까지 포함한 Next.js 앱입니다.

## 시작

```bash
npm install
npm run dev
```

빌드 검증:

```bash
npm run build
```

## 환경 변수

`.env.local` 파일을 만들어 아래 변수를 채웁니다. 없으면 앱은 mock provider와 로컬 저장으로 자동 fallback합니다.

```bash
# 장소 검색 실데이터 (없으면 mock)
KAKAO_REST_API_KEY=

# 대중교통 경로 실데이터 (없으면 mock)
ODSAY_API_KEY=

# 저장/공유/캐시 계층 (없으면 로컬 전용)
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# NextAuth 필수 (세션 암호화 키)
NEXTAUTH_SECRET=
NEXTAUTH_URL=https://your-domain.com

# 카카오 소셜 로그인 (선택)
KAKAO_CLIENT_ID=
KAKAO_CLIENT_SECRET=
NEXT_PUBLIC_KAKAO_AUTH_ENABLED=false
NEXT_PUBLIC_KAKAO_JS_KEY=
```

`NEXTAUTH_SECRET`은 아래 명령으로 생성합니다:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

## Supabase 설정

저장/공유/캐시가 필요하면 [`supabase/schema.sql`](supabase/schema.sql)을 Supabase SQL 에디터에서 실행합니다.

생성되는 테이블:

- `saved_plans` — 코스 저장
- `api_cache` — 추천/날씨 캐시
- `place_review_summaries` — 장소 리뷰 요약
- `shared_plans` — 코스 공유 및 파트너 투표

## API

| 엔드포인트 | 설명 |
|-----------|------|
| `GET /api/health` | 환경 구성 상태 확인 |
| `GET /api/diagnostics` | provider 상태 상세 확인 |
| `POST /api/chat` | AI 채팅 (P mode 코스 설계) |
| `POST /api/recommendations` | 장소 추천 후보 반환 |
| `POST /api/custom-plan` | 커스텀 추천 → 플래너 구조 변환 |
| `POST /api/planner` | 고정 시나리오 기반 플래너 |
| `GET/POST /api/saved-plans` | 코스 저장/조회 |
| `GET/POST/PATCH /api/shared-plans` | 코스 공유 및 파트너 투표 |
| `GET /api/weather` | 서울 현재 날씨 (30분 캐시) |

## 현재 상태

| 기능 | 상태 |
|------|------|
| 장소 검색 | `KAKAO_REST_API_KEY` 있으면 실데이터, 없으면 mock |
| 대중교통 | `ODSAY_API_KEY` 있으면 실데이터, 없으면 mock |
| 날씨 감지 | Open-Meteo 무료 API (항상 활성) |
| 코스 저장/공유 | Supabase 설정 시 활성, 없으면 로컬 저장 |
| 리뷰 요약 | Supabase `place_review_summaries` 또는 mock |
| 카카오 로그인 | `NEXT_PUBLIC_KAKAO_AUTH_ENABLED=true` + 키 설정 시 활성 |
| AI 채팅 (P mode) | `ANTHROPIC_API_KEY` 있으면 Claude, 없으면 mock 응답 |

## Live 전환 체크리스트

1. 환경 변수 설정 후 `npm run build`
2. `GET /api/health` — `readyForLive: true` 확인
3. `GET /api/diagnostics` — provider 상태 확인
4. `POST /api/recommendations` — `candidates[].source`가 `kakao`인지 확인
