"use client";

import { useState } from "react";
import type { PlannerStep } from "@/lib/types";

export type CourseProgressState = {
  active: boolean;
  currentStepIndex: number;
  checkedInAt: Record<string, string>;
};

type Props = {
  steps: PlannerStep[];
  progress: CourseProgressState;
  onCheckIn: (stepId: string) => void;
  onNext: () => void;
  onEnd: () => void;
  totalMinutes?: number;
  startTime?: string;
};

function formatElapsed(isoStart: string): string {
  const diff = Math.round((Date.now() - new Date(isoStart).getTime()) / 60000);
  if (diff < 60) return `${diff}분 전 도착`;
  return `${Math.floor(diff / 60)}시간 ${diff % 60}분 전 도착`;
}

function formatRemaining(totalMinutes: number, startTime?: string): string {
  const elapsed = startTime
    ? Math.round((Date.now() - new Date(startTime).getTime()) / 60000)
    : 0;
  const remaining = Math.max(0, totalMinutes - elapsed);
  if (remaining < 60) return `${remaining}분 남았어요`;
  return `${Math.floor(remaining / 60)}시간 ${remaining % 60}분 남았어요`;
}

export function CourseProgress({ steps, progress, onCheckIn, onNext, onEnd, totalMinutes, startTime }: Props) {
  const [justCheckedIn, setJustCheckedIn] = useState<string | null>(null);
  const done = progress.currentStepIndex >= steps.length;

  return (
    <div className="course-progress">
      <div className="course-progress__bar">
        <div
          className="course-progress__fill"
          style={{ width: `${(progress.currentStepIndex / steps.length) * 100}%` }}
        />
      </div>

      {totalMinutes && !done && (
        <div className="course-progress__countdown">
          {formatRemaining(totalMinutes, startTime)}
        </div>
      )}

      {done ? (
        <div className="course-progress__done">
          <span>🎉</span>
          <strong>코스 완료!</strong>
          <p>오늘 데이트 수고했어요.</p>
          <button type="button" className="button button--ghost" onClick={onEnd}>
            진행 종료
          </button>
        </div>
      ) : (
        <div className="course-progress__steps">
          {steps.map((step, index) => {
            const isDone = index < progress.currentStepIndex;
            const isCurrent = index === progress.currentStepIndex;
            const checkedIn = progress.checkedInAt[step.id];

            return (
              <div
                key={step.id}
                className={[
                  "progress-step",
                  isDone ? "is-done" : "",
                  isCurrent ? "is-current" : "",
                  justCheckedIn === step.id ? "progress-step--just-checked" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                <div className="progress-step__marker">
                  {isDone ? "✓" : index + 1}
                </div>
                <div className="progress-step__body">
                  <div className="progress-step__meta">
                    {step.category} · {step.transferLabel}
                  </div>
                  <strong>{step.title}</strong>
                  {checkedIn && (
                    <span className="progress-step__time">
                      {formatElapsed(checkedIn)}
                    </span>
                  )}
                  {isCurrent && !checkedIn && (
                    <button
                      type="button"
                      className="button button--soft"
                      onClick={() => {
                        onCheckIn(step.id);
                        setJustCheckedIn(step.id);
                        setTimeout(() => setJustCheckedIn(null), 700);
                      }}
                    >
                      지금 여기예요
                    </button>
                  )}
                  {isCurrent && checkedIn && (
                    <button
                      type="button"
                      className="button button--primary"
                      onClick={onNext}
                    >
                      다음 장소로 →
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <button type="button" className="button button--ghost course-progress__end" onClick={onEnd}>
        진행 종료
      </button>
    </div>
  );
}
