import React from 'react';
import { WeatherMood } from '../../utils/weatherMood';
import './weather-atmosphere.css';

export const WeatherAtmosphere: React.FC<{ mood: WeatherMood }> = ({ mood }) => {
  const raining = ['rain', 'monsoon', 'storm'].includes(mood);
  const daylight = ['sunny', 'sunrise', 'sunset'].includes(mood);
  return <div className={`weather-atmosphere atmosphere-${mood}`} aria-hidden="true">
    <div className="landscape-backdrop" /><div className="atmosphere-wash" />
    {daylight && <><div className="atmosphere-sun" /><div className="atmosphere-sunhalo" /><div className="atmosphere-horizon" /></>}
    {mood !== 'neutral' && <div className="atmosphere-clouds"><i /><i /><i /></div>}
    {raining && <div className="atmosphere-rain">{Array.from({ length: 36 }, (_, i) => <i key={i} style={{ '--x': `${(i * 37) % 101}%`, '--duration': `${1.25 + (i % 7) * .13}s`, '--delay': `${-(i % 13) * .31}s` } as React.CSSProperties} />)}</div>}
    {mood === 'monsoon' && <><svg className="atmosphere-tree" viewBox="0 0 360 620" fill="none"><path d="M310 640 Q280 400 290 220 Q277 135 240 62 M292 300 Q245 270 195 218 L170 138 M286 235 Q326 185 342 110 M289 380 Q244 355 214 310 M265 119 L208 96" stroke="currentColor" strokeWidth="7" strokeLinecap="round" />{[[240,65],[209,96],[174,141],[194,217],[341,111],[325,180],[214,310]].map(([x,y],i) => <ellipse key={i} cx={x} cy={y} rx="13" ry="6" fill="currentColor" transform={`rotate(${i*23-40} ${x} ${y})`} />)}</svg><div className="atmosphere-leaves">{Array.from({ length: 14 },(_,i)=><i key={i} style={{ '--x': `${84 + i % 5 * 3}%`, '--duration': `${12+i%5*2}s`, '--delay': `${-i*1.7}s`, '--drift': `${-100-i%4*90}px` } as React.CSSProperties}/>)}</div></>}
    {mood === 'night' && <><div className="atmosphere-moon"/><div className="atmosphere-stars">{Array.from({length:16},(_,i)=><i key={i} style={{left:`${(i*43)%100}%`,top:`${(i*17)%65}%`,animationDelay:`${-i*.7}s`}}/>)}</div></>}
    {mood === 'snow' && <div className="atmosphere-snow">{Array.from({length:24},(_,i)=><i key={i} style={{'--x':`${i*41%100}%`,'--duration':`${9+i%7}s`,'--delay':`${-i*1.2}s`} as React.CSSProperties}/>)}</div>}
  </div>;
};
