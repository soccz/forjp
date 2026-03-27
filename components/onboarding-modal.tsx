"use client";

import { useState } from "react";

type Props = { onDismiss: () => void };

const STEPS = [
  {
    emoji: "💬",
    title: "P 모드: 대화로 코스 만들기",
    description: "몇 가지 질문에 답하면 동선이 최적화된 코스를 자동으로 만들어드려요. 즉흥적인 데이트에 딱 맞아요.",
  },
  {
    emoji: "✏️",
    title: "J 모드: 직접 수정하기",
    description: "장소 순서를 바꾸고, 대안 장소로 교체하고, 최적 동선 제안도 받을 수 있어요. 꼼꼼하게 계획하는 분께 딱이에요.",
  },
  {
    emoji: "🗺️",
    title: "공유하고 저장하기",
    description: "완성된 코스를 저장하거나 상대방에게 공유할 수 있어요. 함께 코스를 보면서 데이트해보세요.",
  },
];

export function OnboardingModal({ onDismiss }: Props) {
  const [step, setStep] = useState(0);
  const isLast = step === STEPS.length - 1;
  const current = STEPS[step];

  return (
    <div className="onboarding-overlay" onClick={onDismiss}>
      <div
        className="onboarding-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="처음 오셨군요"
      >
        <button
          type="button"
          className="onboarding-modal__skip"
          onClick={onDismiss}
        >
          건너뛰기
        </button>

        <div className="onboarding-modal__emoji">{current.emoji}</div>
        <h3 className="onboarding-modal__title">{current.title}</h3>
        <p className="onboarding-modal__desc">{current.description}</p>

        <div className="onboarding-dots">
          {STEPS.map((_, i) => (
            <span
              key={i}
              className={i === step ? "onboarding-dot is-active" : "onboarding-dot"}
            />
          ))}
        </div>

        <button
          type="button"
          className="button button--primary onboarding-modal__cta"
          onClick={() => {
            if (isLast) {
              onDismiss();
            } else {
              setStep((s) => s + 1);
            }
          }}
        >
          {isLast ? "시작하기" : "다음"}
        </button>
      </div>
    </div>
  );
}
