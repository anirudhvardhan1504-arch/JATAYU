import { CurrentWeatherObservation } from '../types';

export type WeatherMood = 'neutral' | 'sunny' | 'cloudy' | 'rain' | 'monsoon' | 'storm' | 'snow' | 'mist' | 'sunrise' | 'sunset' | 'night';

/** Approximate solar elevation from UTC time and the selected coordinates (not the device timezone). */
export function solarPosition(date: Date, latitude: number, longitude: number) {
  const radians = Math.PI / 180;
  const day = (date.getTime() - Date.UTC(date.getUTCFullYear(), 0, 0)) / 86_400_000;
  const b = 2 * Math.PI * (day - 81) / 364;
  const equation = 9.87 * Math.sin(2 * b) - 7.53 * Math.cos(b) - 1.5 * Math.sin(b);
  const solarMinutes = ((date.getUTCHours() * 60 + date.getUTCMinutes() + equation + 4 * longitude) % 1440 + 1440) % 1440;
  const declination = 23.45 * Math.sin(2 * Math.PI * (284 + day) / 365) * radians;
  const angle = (solarMinutes / 4 - 180) * radians;
  const elevation = Math.asin(Math.sin(latitude * radians) * Math.sin(declination) + Math.cos(latitude * radians) * Math.cos(declination) * Math.cos(angle)) / radians;
  return { elevation, rising: solarMinutes < 720 };
}

export function getWeatherMood(weather: CurrentWeatherObservation | null | undefined, latitude: number, longitude: number, date = new Date()): WeatherMood {
  if (!weather || weather.isStale || weather.sourceType === 'DEMO_DATA' || !Number.isFinite(weather.weatherCode)) return 'neutral';
  const code = weather.weatherCode;
  if (code >= 95) return 'storm';
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return 'snow';
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82) || weather.precipitationMm > 0) {
    const india = latitude >= 6 && latitude <= 38 && longitude >= 68 && longitude <= 98;
    // A seasonal visual treatment, not a meteorological declaration that a monsoon is active.
    return india && date.getUTCMonth() >= 5 && date.getUTCMonth() <= 8 ? 'monsoon' : 'rain';
  }
  const sun = solarPosition(date, latitude, longitude);
  if (sun.elevation < -8) return 'night';
  if (sun.elevation < 9 && code < 3) return sun.rising ? 'sunrise' : 'sunset';
  if (code === 45 || code === 48) return 'mist';
  return code <= 2 ? 'sunny' : 'cloudy';
}

/** Day/night decoration follows local sunlight even if weather is missing or rainy. */
export function isNightAt(date: Date, latitude: number, longitude: number): boolean {
  return Number.isFinite(date.getTime()) && solarPosition(date, latitude, longitude).elevation < -0.833;
}
export type WeatherIconKind = 'sun' | 'moon' | 'cloud-sun' | 'cloud-moon' | 'cloud' | 'rain' | 'storm' | 'snow' | 'fog' | 'unknown';
export function weatherIconKind(code: number | undefined, precipitation: number | undefined, date: Date, lat: number, lon: number): WeatherIconKind {
  if (typeof code === 'number' && Number.isFinite(code)) {
    if (code >= 95) return 'storm';
    if ((code >= 71 && code <= 77) || code === 85 || code === 86) return 'snow';
    if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) return 'rain';
    if (code === 45 || code === 48) return 'fog';
    if (code === 3) return 'cloud';
    const night = isNightAt(date, lat, lon);
    if (code === 1 || code === 2) return night ? 'cloud-moon' : 'cloud-sun';
    if (code === 0) return night ? 'moon' : 'sun';
  }
  if (typeof precipitation === 'number' && precipitation > 0) return 'rain';
  return 'unknown';
}
