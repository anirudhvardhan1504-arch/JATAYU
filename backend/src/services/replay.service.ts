import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Request } from 'express';
import {
  CurrentWeatherObservation,
  WeatherForecastResponse,
} from '../types/weather.types.js';
import { AlertFeedResponse } from '../types/alert.types.js';
import { IndicativeFloodRiskAssessment } from '../types/risk.types.js';
import { EmergencyFacility } from '../types/route.types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface ReplayScenarioSummary {
  scenarioId: string;
  title: string;
  historicalEventDate: string;
  summary: string;
  location: {
    name: string;
    latitude: number;
    longitude: number;
    district: string;
    state: string;
  };
}

export interface ReplayScenarioData extends ReplayScenarioSummary {
  weather: CurrentWeatherObservation;
  forecast: WeatherForecastResponse;
  alerts: AlertFeedResponse;
  risk: IndicativeFloodRiskAssessment;
  facilities: EmergencyFacility[];
}

export class ReplayService {
  private scenarios = new Map<string, ReplayScenarioData>();
  private defaultScenarioId = 'chennai_deluge_2023';

  constructor() {
    this.loadScenarios();
  }

  private loadScenarios(): void {
    const candidateDirs = [
      path.resolve(__dirname, '../data/replay'),
      path.resolve(__dirname, '../../src/data/replay'),
      path.resolve(__dirname, '../../data/replay'),
      path.resolve(process.cwd(), 'src/data/replay'),
      path.resolve(process.cwd(), 'dist/data/replay'),
      path.resolve(process.cwd(), 'backend/src/data/replay'),
      path.resolve(process.cwd(), 'backend/dist/data/replay'),
    ];

    let loadedAny = false;

    for (const dir of candidateDirs) {
      if (fs.existsSync(dir)) {
        try {
          const files = fs.readdirSync(dir).filter((f) => f.endsWith('.json'));
          for (const file of files) {
            const raw = fs.readFileSync(path.join(dir, file), 'utf-8');
            const data = JSON.parse(raw) as ReplayScenarioData;
            if (data && data.scenarioId) {
              this.scenarios.set(data.scenarioId, data);
              loadedAny = true;
            }
          }
          if (loadedAny) break;
        } catch (err) {
          console.warn(`[JATAYU Replay] Could not load scenarios from ${dir}:`, err);
        }
      }
    }

    if (!loadedAny) {
      console.warn('[JATAYU Replay] No scenario JSON files found on disk; falling back to memory baseline.');
    }
  }

  public isReplayRequested(req: Request): boolean {
    if (process.env.DEMO_REPLAY_MODE === 'true') {
      return true;
    }
    const replayHeader = req.headers['x-jatayu-replay-mode'];
    if (replayHeader === 'true' || replayHeader === '1') {
      return true;
    }
    if (req.headers['x-jatayu-replay-scenario']) {
      return true;
    }
    const demoQuery = req.query.demo as string | undefined;
    if (demoQuery === 'replay' || demoQuery === 'true') {
      return true;
    }
    const replayQuery = req.query.replay as string | undefined;
    if (replayQuery === 'true' || replayQuery === '1') {
      return true;
    }
    return false;
  }

  public resolveScenarioId(req: Request, fallbackLat?: number, fallbackLon?: number): string {
    // 1. Explicit scenario header
    const scenarioHeader = req.headers['x-jatayu-replay-scenario'] as string | undefined;
    if (scenarioHeader && this.scenarios.has(scenarioHeader)) {
      return scenarioHeader;
    }

    // 2. Explicit scenario query param
    const scenarioQuery = (req.query.scenario || req.query.scenarioId) as string | undefined;
    if (scenarioQuery && this.scenarios.has(scenarioQuery)) {
      return scenarioQuery;
    }

    // 3. Nearest scenario by geographic proximity if coordinates provided
    const lat = fallbackLat ?? (req.query.lat ? parseFloat(req.query.lat as string) : undefined);
    const lon = fallbackLon ?? (req.query.lon ? parseFloat(req.query.lon as string) : undefined);

    if (lat !== undefined && lon !== undefined && !isNaN(lat) && !isNaN(lon)) {
      let closestScenario = this.defaultScenarioId;
      let minDistance = Infinity;

      for (const [id, scenario] of this.scenarios.entries()) {
        const dLat = lat - scenario.location.latitude;
        const dLon = lon - scenario.location.longitude;
        const distSq = dLat * dLat + dLon * dLon;
        if (distSq < minDistance) {
          minDistance = distSq;
          closestScenario = id;
        }
      }
      return closestScenario;
    }

    return this.defaultScenarioId;
  }

  public listScenarios(): ReplayScenarioSummary[] {
    return Array.from(this.scenarios.values()).map((s) => ({
      scenarioId: s.scenarioId,
      title: s.title,
      historicalEventDate: s.historicalEventDate,
      summary: s.summary,
      location: s.location,
    }));
  }

  public getScenario(scenarioId: string, fallbackToDefault = false): ReplayScenarioData | null {
    if (this.scenarios.has(scenarioId)) {
      return this.scenarios.get(scenarioId)!;
    }
    if (fallbackToDefault) {
      return this.scenarios.get(this.defaultScenarioId) || null;
    }
    return null;
  }

  public getWeather(scenarioId: string): CurrentWeatherObservation | null {
    const scenario = this.getScenario(scenarioId, true);
    return scenario ? scenario.weather : null;
  }

  public getForecast(scenarioId: string): WeatherForecastResponse | null {
    const scenario = this.getScenario(scenarioId, true);
    return scenario ? scenario.forecast : null;
  }

  public getAlerts(scenarioId: string): AlertFeedResponse | null {
    const scenario = this.getScenario(scenarioId, true);
    return scenario ? scenario.alerts : null;
  }

  public getRisk(scenarioId: string): IndicativeFloodRiskAssessment | null {
    const scenario = this.getScenario(scenarioId, true);
    return scenario ? scenario.risk : null;
  }

  public getFacilities(scenarioId: string): EmergencyFacility[] {
    const scenario = this.getScenario(scenarioId, true);
    if (!scenario || !Array.isArray(scenario.facilities)) return [];
    // Enforce UNKNOWN availability unconditionally
    return scenario.facilities.map((f) => ({
      ...f,
      currentAvailability: 'UNKNOWN',
    }));
  }
}

export const replayService = new ReplayService();
