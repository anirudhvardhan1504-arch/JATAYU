import { describe, it, expect } from 'vitest';
import { CurrentWeatherObservation } from '../types';
import { getWeatherMood, solarPosition } from '../utils/weatherMood';

const observation = (weatherCode = 0, precipitationMm = 0) => ({ weatherCode, precipitationMm, isStale: false, sourceType: 'MODEL_ANALYSIS' }) as CurrentWeatherObservation;
const midday = new Date('2026-11-20T07:00:00Z');

describe('Weather-driven appearance', () => {
  it('uses warm sun and cool rain without changing the weather measurements', () => {
    const sunny = observation();
    expect(getWeatherMood(sunny,17.385,78.4867,midday)).toBe('sunny');
    expect(getWeatherMood(observation(61,8),17.385,78.4867,midday)).toBe('rain');
    expect(sunny.precipitationMm).toBe(0);
  });
  it('follows the selected coordinates for sunrise, sunset and night', () => {
    expect(getWeatherMood(observation(),17.385,78.4867,new Date('2026-11-20T00:45:00Z'))).toBe('sunrise');
    expect(getWeatherMood(observation(),17.385,78.4867,new Date('2026-11-20T12:15:00Z'))).toBe('sunset');
    expect(getWeatherMood(observation(),17.385,78.4867,new Date('2026-11-20T18:00:00Z'))).toBe('night');
    expect(solarPosition(midday,17.385,78.4867).elevation).toBeGreaterThan(30);
  });
  it('limits seasonal leaves to rainy summer conditions in the India region', () => {
    const july = new Date('2026-07-20T07:00:00Z');
    expect(getWeatherMood(observation(63,12),17.385,78.4867,july)).toBe('monsoon');
    expect(getWeatherMood(observation(),17.385,78.4867,july)).toBe('sunny');
    expect(getWeatherMood(observation(63,12),51.5,-.1,july)).toBe('rain');
  });
  it('retains storm, snow and fog identities', () => {
    expect(getWeatherMood(observation(95,20),17.385,78.4867,midday)).toBe('storm');
    expect(getWeatherMood(observation(73,3),17.385,78.4867,midday)).toBe('snow');
    expect(getWeatherMood(observation(45),17.385,78.4867,midday)).toBe('mist');
  });
  it('never presents missing, stale or replay weather as a live sunny day', () => {
    expect(getWeatherMood(null,17.385,78.4867,midday)).toBe('neutral');
    expect(getWeatherMood({...observation(),isStale:true},17.385,78.4867,midday)).toBe('neutral');
    expect(getWeatherMood({...observation(),sourceType:'DEMO_DATA'},17.385,78.4867,midday)).toBe('neutral');
  });
});
