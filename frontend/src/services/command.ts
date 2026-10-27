/**
 * Protected Operational Command API Service for JATAYU.
 * Calls privileged server-enforced endpoints with in-memory Bearer token:
 * - GET  /api/command/sectors
 * - GET  /api/command/district-telemetry
 * - GET  /api/command/globe-context
 * - POST /api/command/drills/trigger
 */

export interface OperationalSector {
  id: string;
  name: string;
  label: string;
  coordinates: {
    lat: number;
    lon: number;
  };
  status: string;
  tacticalZone: string;
  coverage: string;
  provenance: string;
}

export interface SectorsResponse {
  sectors: OperationalSector[];
  count: number;
  telemetryTimestamp: string;
  requestedBy: {
    userId: string;
    role: string;
  };
}

export interface ResolvedDistrictTelemetry {
  canonicalDistrict: string | null;
  canonicalState: string | null;
  censusCode?: string;
  matchStatus: 'RESOLVED_DISTRICT' | 'OFFSHORE_OR_UNRESOLVED' | 'BOUNDARY_DATA_UNAVAILABLE';
  datasetSource: string;
  vintage: string;
  coverageNotice?: string;
  isAmbiguous?: boolean;
  secondaryDistricts?: string[];
}

export interface DistrictTelemetryResponse {
  telemetryTimestamp: string;
  query: { lat: number; lon: number };
  operator: { userId: string; role: string };
  district: ResolvedDistrictTelemetry;
}

export interface GlobeContextSession {
  subject: string;
  role: string;
  terrainProvider: string;
  supportedImagery: string[];
  tacticalLayers: string[];
  cameraDefault: {
    lat: number;
    lon: number;
    altitudeMeters: number;
  };
  limits: {
    maxAltitudeMeters: number;
    minAltitudeMeters: number;
  };
  featureFlags: {
    volumetricRadar: boolean;
    terrainElevation: boolean;
    tacticalOverlays: boolean;
  };
  disclaimer: string;
}

export interface GlobeContextResponse {
  authorized: boolean;
  issuedAt: string;
  session: GlobeContextSession;
}

export interface DrillScenarioRequest {
  scenarioType: string;
  sectorName: string;
  severity: string;
}

export interface DrillScenarioResponse {
  drillId: string;
  isSyntheticDrill: boolean;
  isOfficialWarning: boolean;
  warningNotice: string;
  status: string;
  scenario: {
    scenarioType: string;
    sectorName: string;
    severity: string;
  };
  triggeredBy: {
    userId: string;
    role: string;
  };
  timestamp: string;
}

export class CommandApiError extends Error {
  public statusCode: number;
  public code?: string;

  constructor(message: string, statusCode: number, code?: string) {
    super(message);
    this.name = 'CommandApiError';
    this.statusCode = statusCode;
    this.code = code;
  }
}

async function requestWithAuth<T>(
  url: string,
  token: string,
  options?: RequestInit
): Promise<T> {
  if (!token) {
    throw new CommandApiError('Authentication required. Missing Bearer token.', 401, 'AUTH_REQUIRED');
  }

  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...options?.headers,
    },
  });

  if (!response.ok) {
    let errorMsg = `Command request failed with status ${response.status}`;
    let errorCode: string | undefined;

    try {
      const parsed = await response.json();
      if (parsed.error) errorMsg = parsed.error;
      if (parsed.code) errorCode = parsed.code;
    } catch {
      // fallback to status text
    }

    throw new CommandApiError(errorMsg, response.status, errorCode);
  }

  return response.json();
}

/**
 * Fetch verified operational sectors with tactical zoning and provenance.
 * Requires: command:view_sectors (RESPONDER, RESEARCHER, GOVERNMENT, ADMIN)
 */
export async function getOperationalSectors(token: string): Promise<SectorsResponse> {
  return requestWithAuth<SectorsResponse>('/api/command/sectors', token);
}

/**
 * Interrogate district spatial boundary and census data at coordinates.
 * Requires: district:interrogate_telemetry (RESPONDER, RESEARCHER, GOVERNMENT, ADMIN)
 */
export async function getDistrictTelemetry(
  lat: number,
  lon: number,
  token: string
): Promise<DistrictTelemetryResponse> {
  const params = new URLSearchParams({ lat: lat.toString(), lon: lon.toString() });
  return requestWithAuth<DistrictTelemetryResponse>(`/api/command/district-telemetry?${params.toString()}`, token);
}

/**
 * Fetch 3D Command Globe session configuration and layer permissions.
 * Requires: command3d:view_globe (RESEARCHER, GOVERNMENT, ADMIN)
 */
export async function getGlobeContext(token: string): Promise<GlobeContextResponse> {
  return requestWithAuth<GlobeContextResponse>('/api/command/globe-context', token);
}

/**
 * Trigger synthetic multi-agency drill simulation.
 * Requires: drill:trigger_simulation (GOVERNMENT, ADMIN)
 */
export async function triggerSyntheticDrill(
  scenario: DrillScenarioRequest,
  token: string
): Promise<DrillScenarioResponse> {
  return requestWithAuth<DrillScenarioResponse>('/api/command/drills/trigger', token, {
    method: 'POST',
    body: JSON.stringify(scenario),
  });
}
