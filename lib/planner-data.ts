import type { PlannerStep, ScenarioId, ScenarioSummary } from "@/lib/types";

type ScenarioDefinition = {
  id: ScenarioId;
  label: string;
  banner: string;
  intro: string;
  shortDescription: string;
  emphasis: string;
  startLabel: string;
  budgetCap: number;
  profile: {
    headline: string;
    description: string;
    tags: string[];
  };
  baseMood: number;
  altPanel: {
    stepId: string;
    title: string;
    copy: string;
    candidate: {
      title: string;
      description: string;
      transferLabel: string;
      transferMinutes: number;
      priceValue: number;
      trustScore: number;
      walkIntensity: "low" | "medium" | "high";
      tags: string[];
    };
  };
  steps: PlannerStep[];
};

function step(input: Omit<PlannerStep, "stayLabel" | "priceLabel">): PlannerStep {
  return {
    ...input,
    stayLabel: `${input.stayMinutes}분`,
    priceLabel: `${input.priceValue.toLocaleString("ko-KR")}원`,
  };
}

export const scenarioSummaries: ScenarioSummary[] = [
  {
    id: "afterwork",
    label: "퇴근 후 3시간",
    shortDescription: "짧고 밀도 있게 움직이는 역세권 코스",
    emphasis: "환승 최소 · 부담 없는 예산",
  },
  {
    id: "anniversary",
    label: "기념일",
    shortDescription: "무드와 디테일을 살린 저녁 중심 코스",
    emphasis: "사진 포인트 · 야간 감정선",
  },
  {
    id: "rainy",
    label: "비 오는 날",
    shortDescription: "실내와 지하 연결 동선 위주의 코스",
    emphasis: "도보 스트레스 완화",
  },
  {
    id: "blind",
    label: "소개팅",
    shortDescription: "조용하고 대화 중심인 안전한 흐름",
    emphasis: "낮은 피로도 · 높은 대화 적합성",
  },
];

export const scenarios: Record<ScenarioId, ScenarioDefinition> = {
  afterwork: {
    id: "afterwork",
    label: "퇴근 후 3시간 데이트",
    banner: "After work compact route",
    intro:
      "시간이 길지 않을 때는 장소 수보다 전환감이 중요합니다. 이동 부담을 낮추고 분위기 흐름을 정리한 코스입니다.",
    shortDescription: "짧고 밀도 있게 움직이는 역세권 코스",
    emphasis: "환승 최소 · 부담 없는 예산",
    startLabel: "성수역 3번 출구",
    budgetCap: 80000,
    profile: {
      headline: "퇴근 후 가볍지만 허술하지 않게",
      description:
        "조용함, 역세권, 사진발, 짧은 도보 구간을 우선 반영한 저녁형 취향 프로필입니다.",
      tags: ["조용한 편", "도보 짧게", "사진발", "실내 우선"],
    },
    baseMood: 86,
    altPanel: {
      stepId: "cafe",
      title: "카페 위치가 조금 애매해요",
      copy: "분위기는 유지하면서 동선만 더 매끈하게 바꿀 수 있는 대안을 준비했습니다.",
      candidate: {
        title: "모먼트 커피",
        description: "채광 좋은 좌석이 있고 좌석 간격이 넓어 대화가 편한 카페",
        transferLabel: "도보 4분",
        transferMinutes: 4,
        priceValue: 16000,
        trustScore: 88,
        walkIntensity: "low",
        tags: ["대안 추천", "채광", "디저트", "좌석 여유"],
      },
    },
    steps: [
      step({
        id: "movie",
        category: "영화",
        title: "메가박스 성수",
        description: "긴 하루 설명 없이 바로 몰입할 수 있는 첫 코스로 적합한 선택",
        slot: "18:20 - 20:18",
        stayMinutes: 118,
        transferLabel: "도보 6분",
        transferMinutes: 6,
        priceValue: 24000,
        trustScore: 86,
        walkIntensity: "low",
        tags: ["몰입도 높음", "실내", "퇴근 후 적합"],
      }),
      step({
        id: "cafe",
        category: "카페",
        title: "레이어드 성수",
        description: "영화 이후 대화 전환을 부드럽게 만드는 디저트 중심 스폿",
        slot: "20:28 - 21:20",
        stayMinutes: 52,
        transferLabel: "버스 1정거장",
        transferMinutes: 10,
        priceValue: 18000,
        trustScore: 84,
        walkIntensity: "medium",
        tags: ["사진발", "디저트", "채광"],
      }),
      step({
        id: "dinner",
        category: "식사",
        title: "연무장 파스타",
        description: "시끄럽지 않고 웨이팅 편차가 작아 마무리 식사로 안정적인 곳",
        slot: "21:30 - 22:35",
        stayMinutes: 65,
        transferLabel: "도보 7분",
        transferMinutes: 7,
        priceValue: 26000,
        trustScore: 87,
        walkIntensity: "medium",
        tags: ["조용함", "웨이팅 안정", "대화 적합"],
      }),
    ],
  },
  anniversary: {
    id: "anniversary",
    label: "기념일 야간 코스",
    banner: "Anniversary detail route",
    intro:
      "특별한 날은 이동 효율만큼 사진 포인트와 감정선이 중요합니다. 저녁 이후의 무드를 길게 가져가는 구조입니다.",
    shortDescription: "무드와 디테일을 살린 저녁 중심 코스",
    emphasis: "사진 포인트 · 야간 감정선",
    startLabel: "을지로입구역 5번 출구",
    budgetCap: 140000,
    profile: {
      headline: "기억에 남는 밤으로 이어지게",
      description:
        "야경, 서비스, 사진 포인트를 높게 잡되 이동이 어색하게 끊기지 않도록 정리한 기념일 프로필입니다.",
      tags: ["야경", "예약 선호", "사진 포인트", "디테일 중시"],
    },
    baseMood: 93,
    altPanel: {
      stepId: "dinner",
      title: "저녁 장소를 더 무드 있게 바꿀 수 있어요",
      copy: "예산 여유가 있다면 야간 감정선이 더 좋은 대안으로 교체할 수 있습니다.",
      candidate: {
        title: "르 시엘 다이닝",
        description: "창가 좌석 비중이 높고 코스 간격이 여유로운 기념일용 다이닝",
        transferLabel: "택시 9분",
        transferMinutes: 9,
        priceValue: 68000,
        trustScore: 91,
        walkIntensity: "low",
        tags: ["야경", "예약 추천", "기념일", "서비스"],
      },
    },
    steps: [
      step({
        id: "gallery",
        category: "전시",
        title: "피크닉 전시관",
        description: "대화와 사진 모두 자연스럽게 시작되는 감도 높은 실내 활동",
        slot: "15:10 - 16:20",
        stayMinutes: 70,
        transferLabel: "도보 5분",
        transferMinutes: 5,
        priceValue: 36000,
        trustScore: 90,
        walkIntensity: "low",
        tags: ["사진 포인트", "실내", "몰입형"],
      }),
      step({
        id: "cafe",
        category: "카페",
        title: "호텔 라운지 카페",
        description: "식사 전 긴장을 풀고 오늘 톤을 맞추기 좋은 정돈된 라운지",
        slot: "16:35 - 17:35",
        stayMinutes: 60,
        transferLabel: "택시 7분",
        transferMinutes: 7,
        priceValue: 24000,
        trustScore: 89,
        walkIntensity: "low",
        tags: ["라운지", "디저트", "뷰"],
      }),
      step({
        id: "dinner",
        category: "식사",
        title: "무드 다이닝 바",
        description: "식사와 가벼운 주류를 함께 이어갈 수 있어 흐름이 끊기지 않는 장소",
        slot: "18:00 - 19:35",
        stayMinutes: 95,
        transferLabel: "도보 6분",
        transferMinutes: 6,
        priceValue: 52000,
        trustScore: 90,
        walkIntensity: "medium",
        tags: ["야경", "코스형", "예약 추천"],
      }),
    ],
  },
  rainy: {
    id: "rainy",
    label: "비 오는 날 실내 코스",
    banner: "Rain-safe indoor route",
    intro:
      "비 오는 날은 멋보다 피로 관리가 먼저입니다. 지하 연결과 짧은 도보를 우선한 실내 중심 플랜입니다.",
    shortDescription: "실내와 지하 연결 동선 위주의 코스",
    emphasis: "도보 스트레스 완화",
    startLabel: "홍대입구역 1번 출구",
    budgetCap: 70000,
    profile: {
      headline: "비 오는 날에도 흐름이 깨지지 않게",
      description:
        "젖는 구간을 줄이고 대중교통 연결이 쉬운 장소를 우선하는 우천 대응형 프로필입니다.",
      tags: ["실내 선호", "지하 연결", "도보 짧게", "부담 적은 예산"],
    },
    baseMood: 84,
    altPanel: {
      stepId: "cafe",
      title: "지하 연결 카페 대안이 있어요",
      copy: "비를 피하고 싶다면 분위기는 비슷하지만 동선이 더 쉬운 장소로 바꿀 수 있습니다.",
      candidate: {
        title: "아케이드 라운지",
        description: "지하 동선으로 이동 가능한 북라운지형 카페",
        transferLabel: "지하 연결 3분",
        transferMinutes: 3,
        priceValue: 15000,
        trustScore: 87,
        walkIntensity: "low",
        tags: ["지하 연결", "조용함", "좌석 여유", "실내"],
      },
    },
    steps: [
      step({
        id: "movie",
        category: "영화",
        title: "CGV 홍대",
        description: "비 오는 날 가장 안정적인 첫 선택. 이동보다 체류 만족도를 우선합니다.",
        slot: "13:40 - 15:45",
        stayMinutes: 125,
        transferLabel: "지하 연결",
        transferMinutes: 2,
        priceValue: 22000,
        trustScore: 86,
        walkIntensity: "low",
        tags: ["비 회피", "실내", "몰입도 높음"],
      }),
      step({
        id: "cafe",
        category: "카페",
        title: "북라운지 카페",
        description: "조용한 좌석 비중이 높아 대화와 휴식에 모두 무난한 선택",
        slot: "16:00 - 16:55",
        stayMinutes: 55,
        transferLabel: "도보 3분",
        transferMinutes: 3,
        priceValue: 16000,
        trustScore: 84,
        walkIntensity: "low",
        tags: ["조용함", "사진발", "좌석 넓음"],
      }),
      step({
        id: "dinner",
        category: "식사",
        title: "우동 작업실",
        description: "우천 시 만족도가 높은 따뜻한 메뉴 중심의 저자극 식당",
        slot: "17:10 - 18:15",
        stayMinutes: 65,
        transferLabel: "버스 1정거장",
        transferMinutes: 8,
        priceValue: 20000,
        trustScore: 88,
        walkIntensity: "medium",
        tags: ["따뜻한 음식", "비 오는 날", "부담 적음"],
      }),
    ],
  },
  blind: {
    id: "blind",
    label: "소개팅 대화형 코스",
    banner: "First-date safe route",
    intro:
      "첫 만남은 과한 개성보다 대화의 흐름이 중요합니다. 소음과 이동 피로를 낮추고 선택지를 열어 둔 구조입니다.",
    shortDescription: "조용하고 대화 중심인 안전한 흐름",
    emphasis: "낮은 피로도 · 높은 대화 적합성",
    startLabel: "강남역 11번 출구",
    budgetCap: 60000,
    profile: {
      headline: "부담 없이 대화가 잘 이어지게",
      description:
        "처음 만나는 상황을 고려해 소음이 낮고 실패 가능성이 낮은 곳을 우선한 소개팅 프로필입니다.",
      tags: ["소음 낮음", "예산 안정", "도보 짧게", "대화 중심"],
    },
    baseMood: 88,
    altPanel: {
      stepId: "cafe",
      title: "더 조용한 첫 만남 카페가 있어요",
      copy: "배경 소음이 더 낮고 좌석 간격이 넓은 대안이라 대화에 유리합니다.",
      candidate: {
        title: "세컨드 살롱",
        description: "간격 넓은 좌석과 낮은 음악 볼륨이 강점인 첫 만남용 카페",
        transferLabel: "도보 5분",
        transferMinutes: 5,
        priceValue: 17000,
        trustScore: 89,
        walkIntensity: "low",
        tags: ["소음 낮음", "좌석 간격", "대화 적합", "소개팅"],
      },
    },
    steps: [
      step({
        id: "cafe",
        category: "카페",
        title: "살롱 드 강남",
        description: "첫 만남에서도 부담 없이 오래 앉아 있기 쉬운 정돈된 분위기의 카페",
        slot: "15:00 - 16:10",
        stayMinutes: 70,
        transferLabel: "도보 4분",
        transferMinutes: 4,
        priceValue: 18000,
        trustScore: 87,
        walkIntensity: "low",
        tags: ["대화 적합", "소음 낮음", "디저트"],
      }),
      step({
        id: "dinner",
        category: "식사",
        title: "스몰 플레이트 비스트로",
        description: "메뉴 결정 부담이 적고 좌석 구조가 편안한 대화형 식사 장소",
        slot: "16:22 - 17:35",
        stayMinutes: 73,
        transferLabel: "도보 6분",
        transferMinutes: 6,
        priceValue: 24000,
        trustScore: 86,
        walkIntensity: "medium",
        tags: ["예산 안정", "소개팅 안전", "예약 쉬움"],
      }),
      step({
        id: "walk",
        category: "산책",
        title: "도심 산책 루프",
        description: "식사 후 어색함을 풀고 대화를 이어가기 좋은 짧은 산책 루프",
        slot: "17:45 - 18:15",
        stayMinutes: 30,
        transferLabel: "도보 2분",
        transferMinutes: 2,
        priceValue: 0,
        trustScore: 82,
        walkIntensity: "low",
        tags: ["대화 연장", "분위기 전환", "야외"],
      }),
    ],
  },
};
