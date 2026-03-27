"use client";

import { useEffect, useRef, useState } from "react";
import type {
  ActivityCategory,
  ChatCollected,
  ChatMessage,
  ChatStep,
  PlanVariant,
} from "@/lib/types";
import { buildPlanVariants } from "@/lib/plan-variants";

type Props = {
  onDone: (collected: ChatCollected, variants: PlanVariant[]) => void;
};

const STEP_QUICK_REPLIES: Partial<Record<import("@/lib/types").ChatStep, { label: string; value: string }[]>> = {
  greeting: [
    { label: "퇴근 후 짧게", value: "퇴근 후 짧게" },
    { label: "종일 여유롭게", value: "종일 여유롭게" },
    { label: "기념일", value: "기념일" },
    { label: "소개팅", value: "소개팅" },
  ],
  district: [
    { label: "성수", value: "성수" }, { label: "홍대", value: "홍대" },
    { label: "강남", value: "강남" }, { label: "을지로", value: "을지로" },
    { label: "이태원", value: "이태원" }, { label: "합정", value: "합정" },
    { label: "건대", value: "건대" }, { label: "잠실", value: "잠실" },
  ],
  time: [
    { label: "오후 2시", value: "14:00" }, { label: "오후 5시", value: "17:00" },
    { label: "오후 7시", value: "19:00" }, { label: "오후 8시", value: "20:00" },
  ],
  vibe: [
    { label: "조용하게", value: "quiet" },
    { label: "감성적으로", value: "cinematic" },
    { label: "활기차게", value: "playful" },
  ],
  budget: [
    { label: "3만원", value: "30000" }, { label: "5만원", value: "50000" },
    { label: "8만원", value: "80000" }, { label: "10만원+", value: "100000" },
  ],
};

const DEFAULT_CATEGORIES: ActivityCategory[] = ["cafe", "dinner", "movie"];

export function ChatPlanner({ onDone }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [step, setStep] = useState<ChatStep>("greeting");
  const [collected, setCollected] = useState<Partial<ChatCollected>>({});
  const [inputValue, setInputValue] = useState("");
  const [variants, setVariants] = useState<PlanVariant[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Send first AI message on mount
  useEffect(() => {
    pushAiMessage("어떤 데이트를 계획하고 있어요? 몇 가지만 물어볼게요.");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  function pushAiMessage(content: string) {
    setMessages((prev) => [
      ...prev,
      { id: `ai-${Date.now()}`, role: "ai", content },
    ]);
  }

  function pushUserMessage(content: string) {
    setMessages((prev) => [
      ...prev,
      { id: `user-${Date.now()}`, role: "user", content },
    ]);
  }

  async function handleReply(displayLabel: string, value: string) {
    if (step === "done" || step === "generating") return;

    pushUserMessage(displayLabel);

    // Show loading
    const prevStep = step;
    setStep("generating");

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: value,
          history: messages,
          step: prevStep,
          collected,
        }),
      });

      if (!res.ok) throw new Error("chat_api_failed");

      const data = (await res.json()) as {
        reply: string;
        nextStep: ChatStep;
        collected: Partial<ChatCollected>;
      };

      setCollected(data.collected);
      setStep(data.nextStep);

      setTimeout(() => {
        pushAiMessage(data.reply);

        if (data.nextStep === "generating") {
          setTimeout(() => {
            const finalCollected: ChatCollected = {
              district: data.collected.district ?? "성수",
              startTime: data.collected.startTime ?? "19:00",
              vibe: data.collected.vibe ?? "quiet",
              budgetCap: data.collected.budgetCap ?? 80000,
              categories: DEFAULT_CATEGORIES,
            };
            void fetchAndBuildVariants(finalCollected).then((v) => {
              setVariants(v);
              setStep("done");
              pushAiMessage("3가지 코스를 준비했어요. 마음에 드는 걸 고르면 직접 수정도 할 수 있어요.");
            });
          }, 1200);
        }
      }, 300);
    } catch {
      // fallback: restore previous step
      setStep(prevStep);
      pushAiMessage("잠시 오류가 있었어요. 다시 시도해주세요.");
    }

    setInputValue("");
  }

  async function fetchAndBuildVariants(
    finalCollected: ChatCollected
  ): Promise<PlanVariant[]> {
    try {
      const res = await fetch("/api/recommendations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          district: finalCollected.district,
          originLabel: finalCollected.district,
          categories: finalCollected.categories,
          preferences: {
            budgetCap: finalCollected.budgetCap,
            walkPreference: "balanced",
            vibePreference: finalCollected.vibe,
            indoorPriority: false,
          },
        }),
      });

      if (!res.ok) throw new Error("fetch failed");

      const data = (await res.json()) as { candidates?: import("@/lib/types").VenueCandidate[] };
      const candidates = data.candidates ?? [];

      // district center as origin fallback
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
      const origin = districtCenters[finalCollected.district] ?? districtCenters["성수"];

      return buildPlanVariants(candidates, finalCollected.categories, origin);
    } catch {
      return [];
    }
  }

  function handleFreeInput() {
    const trimmed = inputValue.trim();
    if (!trimmed) return;
    void handleReply(trimmed, trimmed);
  }

  const currentQuickReplies = step !== "generating" && step !== "done"
    ? STEP_QUICK_REPLIES[step]
    : undefined;

  return (
    <div className="chat-planner">
      <div className="chat-messages">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`chat-bubble chat-bubble--${msg.role}`}
          >
            {msg.content}
          </div>
        ))}

        {step === "generating" && (
          <div className="chat-bubble chat-bubble--ai chat-bubble--loading">
            <span className="chat-dot" />
            <span className="chat-dot" />
            <span className="chat-dot" />
          </div>
        )}

        {step === "done" && variants.length > 0 && (
          <div className="plan-variant-list">
            {variants.map((variant) => (
              <button
                key={variant.theme}
                className="plan-variant-card"
                onClick={() => onDone(
                  {
                    district: collected.district ?? "성수",
                    startTime: collected.startTime ?? "19:00",
                    vibe: collected.vibe ?? "quiet",
                    budgetCap: collected.budgetCap ?? 80000,
                    categories: DEFAULT_CATEGORIES,
                  },
                  variants
                )}
              >
                <div className="plan-variant-card__label">{variant.label}</div>
                <div className="plan-variant-card__tagline">{variant.tagline}</div>
                <div className="plan-variant-card__meta">
                  {variant.candidates.map((c) => c.name).join(" → ")}
                </div>
                <div className="plan-variant-card__stats">
                  {Math.round(variant.totalMinutes / 60)}시간{" "}
                  · {variant.totalCost.toLocaleString("ko-KR")}원
                </div>
              </button>
            ))}
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {currentQuickReplies && (
        <div className="chat-quick-replies">
          {currentQuickReplies.map((qr) => (
            <button
              key={qr.value}
              className="chat-quick-reply"
              onClick={() => void handleReply(qr.label, qr.value)}
            >
              {qr.label}
            </button>
          ))}
        </div>
      )}

      {step !== "generating" && step !== "done" && (
        <div className="chat-input-row">
          <input
            className="chat-input"
            placeholder="직접 입력..."
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleFreeInput();
            }}
          />
          <button className="chat-send-btn" onClick={handleFreeInput}>
            전송
          </button>
        </div>
      )}
    </div>
  );
}
