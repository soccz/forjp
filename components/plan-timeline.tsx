"use client";

type TimelineStop = {
  id: string;
  name: string;
  category: string;
  arrivalTime: string;   // "14:30"
  departureTime: string; // "16:00"
  stayMinutes: number;
  transitMinutes: number;
  transitLabel: string;
};

type Props = {
  stops: TimelineStop[];
};

function parseHHMM(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + (m ?? 0);
}

function addMinutes(hhmm: string, minutes: number): string {
  const total = parseHHMM(hhmm) + minutes;
  const h = Math.floor(total / 60) % 24;
  const m = total % 60;
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
}

const CATEGORY_EMOJI: Record<string, string> = {
  cafe: "☕", dinner: "🍽", movie: "🎬", bar: "🍸", gallery: "🎨", walk: "🚶",
};

export function buildTimelineStops(
  venues: Array<{ id: string; name: string; category: string; stayMinutes: number; travelMinutes: number; transitMode: string }>,
  startTime: string
): TimelineStop[] {
  const stops: TimelineStop[] = [];
  let cursor = startTime;
  for (const v of venues) {
    const arrival = cursor;
    const departure = addMinutes(arrival, v.stayMinutes);
    const transitLabel = v.transitMode === "walk" ? `도보 ${v.travelMinutes}분` : v.transitMode === "subway" ? `지하철 ${v.travelMinutes}분` : `이동 ${v.travelMinutes}분`;
    stops.push({ id: v.id, name: v.name, category: v.category, arrivalTime: arrival, departureTime: departure, stayMinutes: v.stayMinutes, transitMinutes: v.travelMinutes, transitLabel });
    cursor = addMinutes(departure, v.travelMinutes);
  }
  return stops;
}

export function PlanTimeline({ stops }: Props) {
  if (!stops.length) return null;
  return (
    <div className="plan-timeline">
      {stops.map((stop, i) => (
        <div key={stop.id} className="timeline-stop">
          <div className="timeline-stop__time-col">
            <span className="timeline-stop__arrival">{stop.arrivalTime}</span>
            <div className="timeline-stop__bar" />
            <span className="timeline-stop__departure">{stop.departureTime}</span>
          </div>
          <div className="timeline-stop__content">
            <div className="timeline-stop__name">
              {CATEGORY_EMOJI[stop.category] ?? "📍"} {stop.name}
            </div>
            <div className="timeline-stop__meta">{stop.stayMinutes}분 체류</div>
          </div>
          {i < stops.length - 1 && (
            <div className="timeline-transit">
              <span className="timeline-transit__label">↓ {stop.transitLabel}</span>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
