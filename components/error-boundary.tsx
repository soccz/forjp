"use client";

import { Component, type ReactNode } from "react";

type Props = { children: ReactNode };
type State = { hasError: boolean; error: Error | null };

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error) {
    if (typeof window !== "undefined" && (window as unknown as { Sentry?: { captureException: (e: Error) => void } }).Sentry) {
      (window as unknown as { Sentry: { captureException: (e: Error) => void } }).Sentry.captureException(error);
    }
    console.error("[ErrorBoundary]", error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="error-boundary">
          <div className="error-boundary__card">
            <h2>코스를 불러오지 못했습니다</h2>
            <p>일시적인 오류가 발생했어요. 다시 시도해주세요.</p>
            <button
              type="button"
              className="button button--primary"
              onClick={() => window.location.reload()}
            >
              다시 시도
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
