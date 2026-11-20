/** Extend small weather fixtures to a realistic 24h history + 72h rolling response. */
export function completeWeatherFixture<T extends { current: { time: string }; hourly: Record<string, unknown[]> }>(payload: T): T {
  const hour = Math.floor(Date.parse(`${payload.current.time.replace(/Z$/, '')}Z`) / 3_600_000) * 3_600_000;
  const hourly = Object.fromEntries(Object.entries(payload.hourly).map(([key, values]) => [key,
    Array.from({ length: 96 }, (_, i) => key === 'time'
      ? new Date(hour + (i - 24) * 3_600_000).toISOString().slice(0, 16)
      : values[i % values.length]),
  ]));
  return { ...payload, hourly };
}
