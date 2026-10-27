import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
// @ts-ignore
import whichPolygon from 'which-polygon';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface DistrictFeatureProperties {
  district: string;
  state: string;
  censusCode?: string;
  stateCode?: number;
  districtCode?: number;
}

export interface ResolvedDistrictResult {
  canonicalDistrict: string;
  canonicalState: string;
  censusCode?: string;
  matchStatus: 'RESOLVED_DISTRICT' | 'OFFSHORE_OR_UNRESOLVED' | 'BOUNDARY_DATA_UNAVAILABLE';
  datasetSource: string;
  vintage: string;
  coverageNotice?: string;
  isAmbiguous?: boolean;
  secondaryDistricts?: string[];
}

export const HOMONYMOUS_DISTRICTS = new Set([
  'AURANGABAD',
  'BIJAPUR',
  'BILASPUR',
  'HAMIRPUR',
  'PRATAPGARH',
  'RAIGARH',
  'BALRAMPUR',
  'EAST',
  'NORTH',
  'SOUTH',
  'WEST',
]);

const STATE_ALIASES: Record<string, string> = {
  HP: 'HIMACHAL PRADESH',
  HIMACHAL: 'HIMACHAL PRADESH',
  'HIMACHAL PRADESH': 'HIMACHAL PRADESH',
  CG: 'CHHATTISGARH',
  CHHATTISGARH: 'CHHATTISGARH',
  UP: 'UTTAR PRADESH',
  'UTTAR PRADESH': 'UTTAR PRADESH',
  BIHAR: 'BIHAR',
  MAHARASHTRA: 'MAHARASHTRA',
  MH: 'MAHARASHTRA',
  RAJASTHAN: 'RAJASTHAN',
  RJ: 'RAJASTHAN',
  KARNATAKA: 'KARNATAKA',
  KA: 'KARNATAKA',
  DELHI: 'NCT OF DELHI',
  'NCT OF DELHI': 'NCT OF DELHI',
  SIKKIM: 'SIKKIM',
  'TAMIL NADU': 'TAMIL NADU',
  TN: 'TAMIL NADU',
  ASSAM: 'ASSAM',
  UTTARAKHAND: 'UTTARAKHAND',
  UK: 'UTTARAKHAND',
  'WEST BENGAL': 'WEST BENGAL',
  WB: 'WEST BENGAL',
  GUJARAT: 'GUJARAT',
  TELANGANA: 'TELANGANA',
};

export class DistrictBoundaryService {
  private queryFn: whichPolygon.Query<DistrictFeatureProperties> | null = null;
  private isLoaded: boolean = false;
  private loadError: string | null = null;
  private synonymsMap: Map<string, { canonicalDistrict: string; state: string }> = new Map();

  private metadata = {
    source: 'DataMeet India Community Maps (Census 2011 Districts)',
    vintage: '2011 Census of India administrative delimitation',
    crs: 'EPSG:4326 (WGS84)',
    attribution: 'District boundaries by DataMeet India community under CC BY 4.0',
  };

  constructor(customGeoJsonPath?: string, customSynonymsPath?: string) {
    this.init(customGeoJsonPath, customSynonymsPath);
  }

  private init(customGeoJsonPath?: string, customSynonymsPath?: string) {
    try {
      const defaultGeoPath = path.resolve(__dirname, '../data/geo/india_districts_simplified.geojson');
      const fallbackSrcGeoPath = path.resolve(__dirname, '../../src/data/geo/india_districts_simplified.geojson');
      const geoPath = customGeoJsonPath || (fs.existsSync(defaultGeoPath) ? defaultGeoPath : fallbackSrcGeoPath);

      if (fs.existsSync(geoPath)) {
        const rawJson = fs.readFileSync(geoPath, 'utf-8');
        const geojson = JSON.parse(rawJson);
        if (geojson.metadata?.source) {
          this.metadata.source = geojson.metadata.source;
          this.metadata.vintage = geojson.metadata.vintage;
        }
        this.queryFn = whichPolygon(geojson);
        this.isLoaded = true;
      } else {
        this.loadError = `Boundary file not found at ${geoPath}`;
      }

      const defaultSynPath = path.resolve(__dirname, '../data/geo/imd_district_synonyms.json');
      const fallbackSrcSynPath = path.resolve(__dirname, '../../src/data/geo/imd_district_synonyms.json');
      const synPath = customSynonymsPath || (fs.existsSync(defaultSynPath) ? defaultSynPath : fallbackSrcSynPath);
      if (fs.existsSync(synPath)) {
        const rawSyn = fs.readFileSync(synPath, 'utf-8');
        const parsed = JSON.parse(rawSyn);
        if (parsed.mappings) {
          for (const [key, val] of Object.entries(parsed.mappings as Record<string, any>)) {
            const canonical = { canonicalDistrict: val.canonicalDistrict, state: val.state };
            this.synonymsMap.set(key.toUpperCase(), canonical);
            if (Array.isArray(val.aliases)) {
              for (const alias of val.aliases) {
                this.synonymsMap.set(String(alias).toUpperCase(), canonical);
              }
            }
          }
        }
      }
    } catch (err: any) {
      this.loadError = err.message || 'Failed to initialize DistrictBoundaryService';
      this.isLoaded = false;
    }
  }

  /**
   * Deterministically find the administrative district containing a [lat, lon] coordinate.
   * Uses WGS84 point-in-polygon lookup against the indexed boundary dataset.
   */
  public findDistrictByCoordinates(lat: number, lon: number): ResolvedDistrictResult | null {
    if (typeof lat !== 'number' || typeof lon !== 'number' || isNaN(lat) || isNaN(lon)) {
      return null;
    }

    if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
      return null;
    }

    if (!this.isLoaded || !this.queryFn) {
      return {
        canonicalDistrict: 'UNKNOWN',
        canonicalState: 'UNKNOWN',
        matchStatus: 'BOUNDARY_DATA_UNAVAILABLE',
        datasetSource: this.metadata.source,
        vintage: this.metadata.vintage,
        coverageNotice: `Spatial boundary dataset offline or failed to initialize: ${this.loadError || 'Unknown error'}`,
      };
    }

    // which-polygon query with multi=true returns all candidate matching polygons containing point
    const results = this.queryFn([lon, lat], true) as DistrictFeatureProperties[] | null;

    if (!results || results.length === 0) {
      return {
        canonicalDistrict: null as any,
        canonicalState: null as any,
        matchStatus: 'OFFSHORE_OR_UNRESOLVED',
        datasetSource: this.metadata.source,
        vintage: this.metadata.vintage,
        coverageNotice: `Selected coordinates (${lat.toFixed(4)}°N, ${lon.toFixed(4)}°E) fall outside covered Indian administrative district polygons. Displaying nationwide nowcast bulletins.`,
      };
    }

    // Deduplicate distinct administrative districts in candidate matches
    const candidateMap = new Map<string, DistrictFeatureProperties>();
    for (const r of results) {
      const key = `${r.district.toUpperCase().trim()}::${r.state.toUpperCase().trim()}`;
      if (!candidateMap.has(key)) {
        candidateMap.set(key, r);
      }
    }
    const distinctCandidates = Array.from(candidateMap.values());
    const primary = distinctCandidates[0];

    const isAmbiguous = distinctCandidates.length > 1;
    const secondaryDistricts = isAmbiguous
      ? distinctCandidates.slice(1).map((c) => c.district)
      : undefined;

    const coverageNotice = isAmbiguous
      ? `Selected coordinates lie in boundary overlap or border zone between ${primary.district} (${primary.state}) and ${distinctCandidates
          .slice(1)
          .map((c) => `${c.district} (${c.state})`)
          .join(', ')}.`
      : undefined;

    return {
      canonicalDistrict: primary.district,
      canonicalState: primary.state,
      censusCode: primary.censusCode,
      matchStatus: 'RESOLVED_DISTRICT',
      datasetSource: this.metadata.source,
      vintage: this.metadata.vintage,
      isAmbiguous,
      secondaryDistricts,
      coverageNotice,
    };
  }

  /**
   * Normalize an IMD bulletin district title to a canonical district identifier.
   */
  public normalizeImdDistrictName(rawTitle: string): {
    normalizedDistrict: string;
    normalizedState?: string;
    isRecognized: boolean;
  } {
    if (!rawTitle || typeof rawTitle !== 'string') {
      return { normalizedDistrict: '', isRecognized: false };
    }

    const rawUpper = rawTitle.toUpperCase().trim();

    // Check exact raw match in synonyms first (handles e.g. "BILASPUR (HP)" or "RAIGAD")
    if (this.synonymsMap.has(rawUpper)) {
      const match = this.synonymsMap.get(rawUpper)!;
      return {
        normalizedDistrict: match.canonicalDistrict,
        normalizedState: match.state,
        isRecognized: true,
      };
    }

    // Detect state qualifiers from parentheses or commas: e.g. "BILASPUR (HP)", "AURANGABAD (BIHAR)"
    let detectedState: string | undefined;
    const parenMatch = rawUpper.match(/\(([^)]+)\)/);
    if (parenMatch) {
      const candidateStateKey = parenMatch[1].trim();
      if (STATE_ALIASES[candidateStateKey]) {
        detectedState = STATE_ALIASES[candidateStateKey];
      }
    } else {
      const commaMatch = rawUpper.match(/,\s*([A-Z\s]+)$/);
      if (commaMatch) {
        const candidateStateKey = commaMatch[1].trim();
        if (STATE_ALIASES[candidateStateKey]) {
          detectedState = STATE_ALIASES[candidateStateKey];
        }
      }
    }

    const cleaned = rawUpper
      .replace(/,\s*INDIA\b/g, '')
      .replace(/\bINDIA\b/g, '')
      .replace(/DISTRICT/g, '')
      .replace(/[\(\)\[\],.]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    // Check synonym dictionary with cleaned string
    if (this.synonymsMap.has(cleaned)) {
      const match = this.synonymsMap.get(cleaned)!;
      return {
        normalizedDistrict: match.canonicalDistrict,
        normalizedState: match.state,
        isRecognized: true,
      };
    }

    // If not in synonyms dictionary, return cleaned district and any detected state
    return {
      normalizedDistrict: cleaned,
      normalizedState: detectedState,
      isRecognized: false,
    };
  }

  /**
   * Check whether an IMD bulletin corresponds to a resolved district.
   */
  public isBulletinMatch(
    bulletinDistrictTitle: string,
    resolvedDistrict: string,
    resolvedState?: string
  ): boolean {
    if (!bulletinDistrictTitle || !resolvedDistrict) return false;

    const norm = this.normalizeImdDistrictName(bulletinDistrictTitle);
    const resolvedUpper = resolvedDistrict.toUpperCase().trim();
    const resolvedStateUpper = resolvedState?.toUpperCase().trim();

    // Homonymous district check:
    // If the district name exists across multiple Indian states (e.g. BILASPUR, AURANGABAD, HAMIRPUR, PRATAPGARH, RAIGARH)
    // and the bulletin lacks a verified state matching the resolved state, reject the match.
    // This routes ambiguous bulletins to nationwideAlerts with NOT_LOCATION_MATCHED.
    const isHomonymous =
      HOMONYMOUS_DISTRICTS.has(resolvedUpper) ||
      HOMONYMOUS_DISTRICTS.has(norm.normalizedDistrict);

    if (isHomonymous) {
      if (!norm.normalizedState || !resolvedStateUpper || norm.normalizedState !== resolvedStateUpper) {
        return false;
      }
    }

    if (norm.normalizedDistrict === resolvedUpper) {
      if (resolvedStateUpper && norm.normalizedState && norm.normalizedState !== resolvedStateUpper) {
        // District name matches but state is explicitly different
        return false;
      }
      return true;
    }

    // If normalized bulletin name matches synonym alias for this resolved district
    const resolvedNorm = this.synonymsMap.get(resolvedUpper);
    if (resolvedNorm && resolvedNorm.canonicalDistrict === norm.normalizedDistrict) {
      if (resolvedStateUpper && resolvedNorm.state && resolvedNorm.state !== resolvedStateUpper) {
        return false;
      }
      return true;
    }

    return false;
  }
}
