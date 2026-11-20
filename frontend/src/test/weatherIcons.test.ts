import { describe, it, expect } from 'vitest';
import { isNightAt, weatherIconKind } from '../utils/weatherMood';
const lat=17.385, lon=78.4867;
const day=new Date('2026-11-20T07:00:00Z'),night=new Date('2026-11-20T18:00:00Z');
describe('Condition and time-based weather icons',()=>{
 it('shows sun by day and moon at night for clear forecasts',()=>{expect(weatherIconKind(0,0,day,lat,lon)).toBe('sun');expect(weatherIconKind(0,0,night,lat,lon)).toBe('moon');});
 it('distinguishes partial clouds, overcast, precipitation and severe weather',()=>{expect(weatherIconKind(2,0,day,lat,lon)).toBe('cloud-sun');expect(weatherIconKind(2,0,night,lat,lon)).toBe('cloud-moon');expect(weatherIconKind(3,0,night,lat,lon)).toBe('cloud');expect(weatherIconKind(61,2,night,lat,lon)).toBe('rain');expect(weatherIconKind(95,4,day,lat,lon)).toBe('storm');expect(weatherIconKind(73,1,day,lat,lon)).toBe('snow');});
 it('does not pretend unknown forecast codes are sunny',()=>{expect(weatherIconKind(undefined,0,day,lat,lon)).toBe('unknown');expect(weatherIconKind(undefined,2,night,lat,lon)).toBe('rain');});
 it('selects the night landscape independently of weather availability and follows the selected coordinates',()=>{expect(isNightAt(night,lat,lon)).toBe(true);expect(isNightAt(day,lat,lon)).toBe(false);expect(isNightAt(day,lat,-100)).toBe(true);});
});
