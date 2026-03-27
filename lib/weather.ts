export type WeatherCondition = "clear" | "cloudy" | "rainy" | "snowy";

export type WeatherInfo = {
  condition: WeatherCondition;
  temperatureCelsius: number;
  isRainy: boolean;
};

// Seoul coordinates
const SEOUL_LAT = 37.5665;
const SEOUL_LON = 126.9780;

export async function getSeoulWeather(): Promise<WeatherInfo | null> {
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${SEOUL_LAT}&longitude=${SEOUL_LON}&current=temperature_2m,weather_code&timezone=Asia%2FSeoul`;
    const res = await fetch(url, { next: { revalidate: 1800 } }); // cache 30min
    if (!res.ok) return null;
    const data = await res.json() as {
      current: { temperature_2m: number; weather_code: number };
    };
    const code = data.current.weather_code;
    const temp = data.current.temperature_2m;
    // WMO weather codes: 0=clear, 1-3=cloudy, 51-67=rain, 71-77=snow, 80-82=rain showers
    const isRainy = (code >= 51 && code <= 67) || (code >= 80 && code <= 82);
    const isSnowy = code >= 71 && code <= 77;
    const condition: WeatherCondition = isRainy ? "rainy" : isSnowy ? "snowy" : code <= 3 ? "clear" : "cloudy";
    return { condition, temperatureCelsius: Math.round(temp), isRainy };
  } catch {
    return null;
  }
}
