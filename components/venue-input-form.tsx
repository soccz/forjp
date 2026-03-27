"use client";

import { useState } from "react";
import type { ActivityCategory } from "@/lib/types";

export type CustomVenueInput = {
  name: string;
  category: ActivityCategory;
  notes?: string;
};

type Props = {
  onAdd: (venue: CustomVenueInput) => void;
};

const CATEGORY_OPTIONS: { value: ActivityCategory; label: string }[] = [
  { value: "cafe", label: "카페" },
  { value: "dinner", label: "식사" },
  { value: "movie", label: "영화" },
  { value: "bar", label: "술" },
  { value: "gallery", label: "전시" },
  { value: "walk", label: "산책/실내활동" },
];

export function VenueInputForm({ onAdd }: Props) {
  const [name, setName] = useState("");
  const [category, setCategory] = useState<ActivityCategory>("cafe");
  const [expanded, setExpanded] = useState(false);

  function handleSubmit() {
    const trimmed = name.trim();
    if (!trimmed) return;
    onAdd({ name: trimmed, category });
    setName("");
    setExpanded(false);
  }

  if (!expanded) {
    return (
      <button
        type="button"
        className="venue-add-toggle"
        onClick={() => setExpanded(true)}
      >
        + 내가 원하는 장소 직접 추가
      </button>
    );
  }

  return (
    <div className="venue-input-form">
      <div className="venue-input-form__row">
        <input
          className="text-input"
          placeholder="장소 이름 (예: 오브젝트 카페)"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSubmit();
            if (e.key === "Escape") setExpanded(false);
          }}
          autoFocus
        />
        <select
          className="select-input"
          value={category}
          onChange={(e) => setCategory(e.target.value as ActivityCategory)}
        >
          {CATEGORY_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>
      <div className="venue-input-form__actions">
        <button type="button" className="button button--primary" onClick={handleSubmit}>
          추가
        </button>
        <button type="button" className="button button--ghost" onClick={() => setExpanded(false)}>
          취소
        </button>
      </div>
    </div>
  );
}
