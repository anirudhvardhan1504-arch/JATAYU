/** Open-Meteo timestamps are UTC when requests specify timezone=UTC. */
export function utcTime(value: string): number {
  return Date.parse(/(?:Z|[+-]\d{2}:\d{2})$/.test(value) ? value : `${value}Z`);
}

export function currentHourIndex(times: string[], reference: string, required = true): number {
  const hour = Math.floor(utcTime(reference) / 3_600_000) * 3_600_000;
  const index = times.findIndex((time) => utcTime(time) === hour);
  if (index < 0 && required) throw new Error('Open-Meteo hourly series does not cover the current hour.');
  return index;
}

/** Fail closed: incomplete numerical input must not become calm wind or zero rainfall. */
export function weatherNumber(value: unknown, field: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`Open-Meteo measurement unavailable: ${field}`);
  }
  return value;
}
