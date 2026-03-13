# COUPLE

한국형 대중교통 기반 데이트 플래너 웹앱입니다.  
`P mode / J mode`, 커스텀 코스 생성, 저장/공유, 추천 캐시, provider 진단까지 포함한 Next.js 앱입니다.

## Run

```bash
npm install
npm run dev
```

프로덕션 검증:

```bash
npm run build
npm run start
```

## Environment

`.env.example` 기준으로 환경 변수를 채웁니다.

- `KAKAO_REST_API_KEY`
  - 장소 검색 실데이터 provider
- `ODSAY_API_KEY`
  - 대중교통 시간 계산 실데이터 provider
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
  - 저장/캐시 계층

환경 변수가 없으면 앱은 자동으로 목업 provider와 로컬 저장으로 fallback 합니다.

## Live Switch Checklist

API 키만 넣으면 바로 live provider 경로를 탈 수 있도록 구조는 이미 분리되어 있습니다.

1. `.env.local` 작성
2. `supabase/schema.sql` 적용
3. `npm run build`
4. `GET /api/health`
5. `GET /api/diagnostics`
6. `POST /api/recommendations`

추천 API에서 아래 항목이 보이면 1차 전환이 정상입니다.

- `providerLabel`에 `Kakao Local` 또는 `ODsay transit` 포함
- `providers[].mode`가 `live`
- `candidates[].source`가 `kakao`
- 같은 카테고리 안에 여러 후보가 내려와 `alternativeSuggestion`이 붙을 수 있음

실데이터 장소 후보에는 기본 품질 필터가 적용됩니다.

- 카테고리 불일치 후보 제외
- 너무 먼 후보 제외
- 중복 상호명 제거
- 일부 과도하게 일반적인 체인/장소 타입은 감점 또는 제외
- 필터 후 후보가 비면 같은 카테고리의 mock fallback 사용

주의:

- 리뷰는 아직 외부 플랫폼 실시간 수집이 아니라 `mock` 또는 `Supabase review summaries` 기반입니다.
- 혼잡도/웨이팅은 현재 규칙 기반 시뮬레이션입니다.
- 즉, Kakao/ODsay 키를 넣으면 장소/이동은 실데이터화되지만 리뷰와 혼잡도는 별도 고도화 단계가 남아 있습니다.

## Supabase

다음 SQL을 적용해야 저장/캐시 계층이 완전하게 동작합니다.

- [schema.sql](/Users/hong/main/test/couple/supabase/schema.sql)

적용 대상:

- `saved_plans`
- `api_cache`
- `place_review_summaries`

## APIs

- `GET /api/health`
  - 현재 환경이 실서비스 전환 가능한지와 누락 설정 확인
- `GET /api/diagnostics`
  - provider 상태와 setup 이슈 확인
- `POST /api/recommendations`
  - 추천 후보, 캐시 상태, provider 상태, 시간대 진단, 대체 후보 반환
- `POST /api/custom-plan`
  - 커스텀 추천 결과를 실제 플래너 구조로 변환
- `POST /api/planner`
  - 고정 시나리오 기반 플래너 재계산
- `GET/POST /api/saved-plans`
  - 저장 코스 조회/생성

## Current Status

현재 기본 상태:

- 장소 검색: mock 또는 Kakao Local
- live 장소 검색에는 품질 필터 포함
- 대중교통: mock 또는 ODsay
- 리뷰 요약: mock 또는 Supabase review summaries
- 저장: local 또는 Supabase
- 추천 캐시: memory 또는 Supabase
- 대체 추천: mock/live 장소 후보 안에서 동일 카테고리 대안 계산
- 시간대 진단: 규칙 기반 혼잡/예상 대기 시뮬레이션

## Next

실제 서비스로 올리려면 우선순위는 이렇습니다.

1. Kakao/ODsay 키 연결 후 live provider 응답 shape 검증
2. `place_review_summaries`에 리뷰 요약 적재 후 review provider live 검증
3. Supabase Auth 연동으로 익명 owner key 대신 계정 기반 저장 전환
