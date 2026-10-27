import { fetchJson } from './api';
import { CurrentWeatherObservation, WeatherForecastResponse } from '../types';

export async function getCurrentWeather(
  lat: number = 19.076,
  lon: number = 72.8777,
  name: string = 'Mumbai Operational Center'
): Promise<CurrentWeatherObservation> {
  const query = new URLSearchParams({
    lat: lat.toString(),
    lon: lon.toString(),
    name,
  });
  return fetchJson<CurrentWeatherObservation>(`/weather/current?${query.toString()}`);
}

export async function getWeatherForecast(
  lat: number = 19.076,
  lon: number = 72.8777,
  name: string = 'Mumbai Operational Center'
): Promise<WeatherForecastResponse> {
  const query = new URLSearchParams({
    lat: lat.toString(),
    lon: lon.toString(),
    name,
  });
  return fetchJson<WeatherForecastResponse>(`/weather/forecast?${query.toString()}`);
}

export interface HistoricalWeatherSeries {
  location: {
    latitude: number;
    longitude: number;
    name?: string;
  };
  startDate: string;
  endDate: string;
  daily: {
    time: string[];
    precipitationSum: number[];
    temperatureMax: number[];
    temperatureMin: number[];
  };
  eventAccumulationMm: number;
  peakDailyRainMm: number;
  dataSource: string;
}

export async function getHistoricalWeather(
  lat: number,
  lon: number,
  startDate = '2015-11-28',
  endDate = '2015-12-04',
  name = 'Selected Coordinates'
): Promise<HistoricalWeatherSeries> {
  const query = new URLSearchParams({
    lat: lat.toString(),
    lon: lon.toString(),
    startDate,
    endDate,
    name,
  });
  return fetchJson<HistoricalWeatherSeries>(`/weather/historical?${query.toString()}`);
}
