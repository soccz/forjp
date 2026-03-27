"use client";
import { useState } from "react";

type Props = {
  planLabel: string;
  district: string;
  venueNames: string[];
  totalMinutes: number;
  onSave: (recap: { rating: number; memoryText: string; favoriteVenues: string[] }) => void;
  onClose: () => void;
};

export function DateRecapCard({ planLabel: _planLabel, district, venueNames, totalMinutes, onSave, onClose }: Props) {
  const [rating, setRating] = useState(0);
  const [memoryText, setMemoryText] = useState("");
  const [favorites, setFavorites] = useState<string[]>([]);

  const hours = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;

  function toggleFavorite(name: string) {
    setFavorites(prev => prev.includes(name) ? prev.filter(v => v !== name) : [...prev, name]);
  }

  return (
    <div className="recap-overlay">
      <div className="recap-card">
        <div className="recap-card__header">
          <div className="recap-card__emoji">🎉</div>
          <h2 className="recap-card__title">데이트 완료!</h2>
          <p className="recap-card__summary">
            {district} · {hours > 0 ? `${hours}시간 ` : ""}{mins > 0 ? `${mins}분` : ""} · {venueNames.length}곳
          </p>
        </div>

        <div className="recap-card__section">
          <p className="recap-card__label">오늘 어땠어요?</p>
          <div className="recap-stars">
            {[1,2,3,4,5].map(n => (
              <button key={n} className={`recap-star${rating >= n ? ' recap-star--on' : ''}`} onClick={() => setRating(n)}>★</button>
            ))}
          </div>
        </div>

        <div className="recap-card__section">
          <p className="recap-card__label">가장 좋았던 곳</p>
          <div className="recap-venues">
            {venueNames.map(name => (
              <button
                key={name}
                className={`recap-venue-tag${favorites.includes(name) ? ' recap-venue-tag--on' : ''}`}
                onClick={() => toggleFavorite(name)}
              >
                {favorites.includes(name) ? '❤️ ' : ''}{name}
              </button>
            ))}
          </div>
        </div>

        <div className="recap-card__section">
          <textarea
            className="recap-memo"
            placeholder="한 줄 기억... (예: 석양이 너무 예뻤어)"
            value={memoryText}
            onChange={e => setMemoryText(e.target.value)}
            rows={2}
          />
        </div>

        <div className="recap-card__actions">
          <button className="button button--primary" onClick={() => onSave({ rating, memoryText, favoriteVenues: favorites })}>
            저장하기
          </button>
          <button className="button button--ghost" onClick={onClose}>나중에</button>
        </div>
      </div>
    </div>
  );
}
