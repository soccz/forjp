"use client";

type Props = {
  value: string; // HH:MM
  onChange: (value: string) => void;
  disabled?: boolean;
};

const QUICK_TIMES = [
  { label: "오후 1시", value: "13:00" },
  { label: "오후 3시", value: "15:00" },
  { label: "오후 5시", value: "17:00" },
  { label: "오후 7시", value: "19:00" },
  { label: "오후 8시", value: "20:00" },
];

export function TimePicker({ value, onChange, disabled }: Props) {
  return (
    <div className="time-picker">
      <div className="time-picker__quick">
        {QUICK_TIMES.map((t) => (
          <button
            key={t.value}
            type="button"
            className={value === t.value ? "time-chip is-active" : "time-chip"}
            onClick={() => onChange(t.value)}
            disabled={disabled}
          >
            {t.label}
          </button>
        ))}
      </div>
      <input
        type="time"
        className="time-input"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        aria-label="출발 시간 직접 입력"
      />
    </div>
  );
}
