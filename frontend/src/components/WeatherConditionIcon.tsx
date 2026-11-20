import { Sun, Moon, CloudSun, CloudMoon, Cloud, CloudRain, CloudLightning, CloudSnow, CloudFog, CircleHelp } from 'lucide-react';
import { weatherIconKind } from '../utils/weatherMood';
interface Props { code?: number; precipitation?: number; date: Date; latitude: number; longitude: number; size?: number; }
export const WeatherConditionIcon = ({ code, precipitation, date, latitude, longitude, size = 30 }: Props) => {
  const kind = weatherIconKind(code, precipitation, date, latitude, longitude);
  const Icon = { sun:Sun, moon:Moon, 'cloud-sun':CloudSun, 'cloud-moon':CloudMoon, cloud:Cloud, rain:CloudRain, storm:CloudLightning, snow:CloudSnow, fog:CloudFog, unknown:CircleHelp }[kind];
  return <Icon size={size} strokeWidth={2} aria-hidden="true" className={`condition-icon condition-icon-${kind}`} data-weather-icon={kind} />;
};
