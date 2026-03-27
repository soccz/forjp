import type { ChatCollected, ChatMessage, ChatStep, VibePreference } from "@/lib/types";

export type ChatResponse = {
  reply: string;
  nextStep: ChatStep;
  collected: Partial<ChatCollected>;
};

export type ChatProviderInterface = {
  label: string;
  isLive: boolean;
  respond(
    message: string,
    history: ChatMessage[],
    currentStep: ChatStep,
    collected: Partial<ChatCollected>
  ): Promise<ChatResponse>;
};

// --- Mock provider (state machine fallback) ---

type FlowEntry = {
  aiMessage: (collected: Partial<ChatCollected>) => string;
  nextStep: ChatStep;
  collect: (value: string, collected: Partial<ChatCollected>) => Partial<ChatCollected>;
};

const OCCASION_REPLIES: Record<string, string> = {
  기념일: "특별한 날이네요! 몇 주년이에요?",
  소개팅: "설레겠다! 처음 만나는 분이세요?",
};

const FLOW: Record<ChatStep, FlowEntry> = {
  greeting: {
    aiMessage: () => "어떤 데이트를 계획하고 있어요? 몇 가지만 물어볼게요.",
    nextStep: "district",
    collect: (value, c) => {
      const occasion = Object.keys(OCCASION_REPLIES).find((k) => value.includes(k));
      return occasion ? { ...c, occasionContext: occasion } : c;
    },
  },
  district: {
    aiMessage: () => "어느 지역에서 만날 예정이에요?",
    nextStep: "time",
    collect: (value, c) => ({ ...c, district: value }),
  },
  time: {
    aiMessage: () => "몇 시에 만날 예정이에요?",
    nextStep: "vibe",
    collect: (value, c) => ({ ...c, startTime: value }),
  },
  vibe: {
    aiMessage: () => "어떤 분위기로 가고 싶으세요?",
    nextStep: "budget",
    collect: (value, c) => ({ ...c, vibe: value as VibePreference }),
  },
  budget: {
    aiMessage: () => "1인 예산은 어느 정도 생각하시나요?",
    nextStep: "generating",
    collect: (value, c) => ({ ...c, budgetCap: Number(value) }),
  },
  generating: {
    aiMessage: (c) => `좋아요! ${c.district ?? ""}에서 코스를 만들고 있어요...`,
    nextStep: "done",
    collect: (_, c) => c,
  },
  refining: {
    aiMessage: () => "수정 요청을 반영해서 코스를 다시 만들고 있어요...",
    nextStep: "done",
    collect: (_, c) => c,
  },
  done: {
    aiMessage: () => "3가지 코스를 준비했어요. 마음에 드는 걸 고르면 직접 수정도 할 수 있어요.",
    nextStep: "done",
    collect: (_, c) => c,
  },
};

class MockChatProvider implements ChatProviderInterface {
  label = "Mock Chat";
  isLive = false;

  async respond(
    message: string,
    _history: ChatMessage[],
    currentStep: ChatStep,
    collected: Partial<ChatCollected>
  ): Promise<ChatResponse> {
    const entry = FLOW[currentStep];
    const nextCollected = entry.collect(message, collected);
    const nextStep = entry.nextStep;

    let reply: string;
    if (currentStep === "greeting") {
      const occasion = Object.keys(OCCASION_REPLIES).find((k) => message.includes(k));
      reply = occasion ? OCCASION_REPLIES[occasion] : FLOW[nextStep].aiMessage(nextCollected);
    } else {
      reply = FLOW[nextStep].aiMessage(nextCollected);
    }

    return { reply, nextStep, collected: nextCollected };
  }
}

class ClaudeChatProvider implements ChatProviderInterface {
  label = "Claude AI";
  isLive = true;

  constructor(private readonly apiKey: string) {}

  async respond(
    message: string,
    history: ChatMessage[],
    currentStep: ChatStep,
    collected: Partial<ChatCollected>
  ): Promise<ChatResponse> {
    const systemPrompt = `당신은 한국 커플 데이트 플래너입니다. 사용자와 자연스러운 한국어로 대화하며 데이트 코스를 계획해주세요.

현재 수집된 정보: ${JSON.stringify(collected)}
현재 단계: ${currentStep}

다음 정보를 차례로 수집하세요 (이미 수집된 것은 건너뛰세요):
1. district: 지역 (성수/홍대/강남/을지로/이태원/합정/건대/잠실 중 하나)
2. startTime: 출발 시간 (HH:MM 형식)
3. vibe: 분위기 (quiet/cinematic/playful 중 하나)
4. budgetCap: 1인 예산 (숫자, 원 단위)

모든 정보가 수집되면 nextStep을 "generating"으로 설정하세요.

반드시 다음 JSON 형식으로만 응답하세요:
{
  "reply": "사용자에게 보낼 한국어 메시지",
  "nextStep": "district|time|vibe|budget|generating|done",
  "collected": { "district": "...", "startTime": "...", "vibe": "...", "budgetCap": 숫자 }
}`;

    try {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": this.apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 512,
          system: systemPrompt,
          messages: [
            ...history.map((m) => ({
              role: m.role === "ai" ? "assistant" : "user",
              content: m.content,
            })),
            { role: "user", content: message },
          ],
        }),
      });

      if (!response.ok) throw new Error("claude_api_error");

      const data = (await response.json()) as {
        content: { type: string; text: string }[];
      };

      const text = data.content.find((c) => c.type === "text")?.text ?? "";
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("parse_error");

      const parsed = JSON.parse(jsonMatch[0]) as ChatResponse;
      return {
        reply: parsed.reply,
        nextStep: parsed.nextStep,
        collected: { ...collected, ...parsed.collected },
      };
    } catch {
      // Fall back to mock on any error
      const mock = new MockChatProvider();
      return mock.respond(message, history, currentStep, collected);
    }
  }
}

export function resolveChatProvider(): ChatProviderInterface {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (apiKey) {
    return new ClaudeChatProvider(apiKey);
  }
  return new MockChatProvider();
}
