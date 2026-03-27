"use client";

export function RecommendationSkeleton() {
  return (
    <div className="recommendation-skeleton">
      <div className="skeleton skeleton--title" />
      <div className="skeleton skeleton--text" />
      <div className="skeleton skeleton--text skeleton--text-short" />
      <div className="skeleton skeleton--venue-card" />
      <div className="skeleton skeleton--venue-card" />
      <div className="skeleton skeleton--venue-card" />
    </div>
  );
}

export function ChatMessageSkeleton() {
  return (
    <div className="chat-message-skeleton">
      <div className="skeleton skeleton--bubble" />
    </div>
  );
}

export function PlanVariantSkeleton() {
  return (
    <div className="plan-variant-skeleton">
      <div className="skeleton skeleton--variant-card" />
      <div className="skeleton skeleton--variant-card" />
      <div className="skeleton skeleton--variant-card" />
    </div>
  );
}
