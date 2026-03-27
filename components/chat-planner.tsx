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
import { DISTRICT_CENTERS } from "@/lib/district-centers";

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
  const [selectedVariant, setSelectedVariant] = useState<string | null>(null);
  const [variantSelected, setVariantSelected] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Send first AI message on mount
  useEffect(() => {
    pushAiMessage("어떤 데이트를 계획하고 있어요? 몇 가지만 물어볼게요.");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (collected.vibe) {
      document.body.dataset.vibe = collected.vibe;
    }
    return () => {
      delete document.body.dataset.vibe;
    };
  }, [collected.vibe]);

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
    if (step === "generating") return;
    if (step === "done" && variantSelected) return;

    pushUserMessage(displayLabel);

    // If refining from done state, regenerate variants
    if (step === "done") {
      setStep("generating");
      setTimeout(() => {
        pushAiMessage(`"${displayLabel}" 반영해서 코스를 다시 만들어볼게요.`);
        const finalCollected: ChatCollected = {
          district: collected.district ?? "성수",
          startTime: collected.startTime ?? "19:00",
          vibe: collected.vibe ?? "quiet",
          budgetCap: collected.budgetCap ?? 80000,
          categories: DEFAULT_CATEGORIES,
          occasionContext: collected.occasionContext,
        };
        void fetchAndBuildVariants(finalCollected).then((v) => {
          if (!v.length) {
            setStep("done");
            pushAiMessage("코스를 다시 만들지 못했어요. 잠시 후 다시 시도해주세요.");
            return;
          }
          setVariants(v);
          setStep("done");
          pushAiMessage("수정된 코스 5가지를 준비했어요. 마음에 드는 걸 골라주세요.");
        }).catch(() => {
          setStep("done");
          pushAiMessage("코스를 다시 만들지 못했어요. 잠시 후 다시 시도해주세요.");
        });
      }, 600);
      setInputValue("");
      return;
    }

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

      setCollected((prev) => ({ ...prev, ...data.collected }));
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
              occasionContext: data.collected.occasionContext,
            };
            void fetchAndBuildVariants(finalCollected).then((v) => {
              if (!v.length) {
                setStep("done");
                pushAiMessage("코스를 만들지 못했어요. 잠시 후 다시 시도해주세요.");
                return;
              }
              setVariants(v);
              setStep("done");
              const occasionGreeting = finalCollected.occasionContext === "기념일"
                ? "기념일에 어울리는 코스를 준비했어요. "
                : finalCollected.occasionContext === "소개팅"
                ? "설레는 첫 만남을 위한 코스를 준비했어요. "
                : "";
              pushAiMessage(`${occasionGreeting}5가지 코스를 준비했어요. 마음에 드는 걸 고르면 직접 수정도 할 수 있어요.`);
            }).catch(() => {
              setStep("done");
              pushAiMessage("코스를 만들지 못했어요. 잠시 후 다시 시도해주세요.");
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

      const origin = DISTRICT_CENTERS[finalCollected.district] ?? DISTRICT_CENTERS["성수"];

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
                className={`plan-variant-card${selectedVariant === variant.theme ? ' is-selected' : ''}`}
                onClick={() => {
                  setSelectedVariant(variant.theme);
                  setVariantSelected(true);
                  setTimeout(() => onDone(
                    {
                      district: collected.district ?? "성수",
                      startTime: collected.startTime ?? "19:00",
                      vibe: collected.vibe ?? "quiet",
                      budgetCap: collected.budgetCap ?? 80000,
                      categories: DEFAULT_CATEGORIES,
                      occasionContext: collected.occasionContext,
                    },
                    variants
                  ), 300);
                }}
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

      {step === "done" && !variantSelected && (
        <div className="chat-quick-replies">
          <button className="chat-quick-reply" onClick={() => void handleReply("카페를 더 조용한 곳으로", "카페를 더 조용한 곳으로")}>카페 바꿔줘</button>
          <button className="chat-quick-reply" onClick={() => void handleReply("예산을 낮춰줘", "예산을 낮춰줘")}>예산 낮춰줘</button>
          <button className="chat-quick-reply" onClick={() => void handleReply("더 감성적으로", "더 감성적으로")}>더 감성적으로</button>
        </div>
      )}

      {(step !== "generating") && (step !== "done" || !variantSelected) && (
        <div className="chat-input-row">
          <input
            className="chat-input"
            placeholder={step === "done" ? "수정 요청... (예: 카페를 더 조용한 곳으로)" : "직접 입력..."}
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
