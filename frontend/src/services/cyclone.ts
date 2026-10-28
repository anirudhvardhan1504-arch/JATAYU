/**
 * JATAYU Cyclone Intelligence & IMD RSMC Best Track Service
 *
 * Sources:
 * - India Meteorological Department (IMD) Cyclone Warning Division
 * - Regional Specialized Meteorological Centre (RSMC) New Delhi
 * - WMO Tropical Cyclone Programme
 */

export type CycloneClassification =
  | 'LOW_PRESSURE_AREA'
  | 'DEPRESSION'
  | 'DEEP_DEPRESSION'
  | 'CYCLONIC_STORM'
  | 'SEVERE_CYCLONIC_STORM'
  | 'VERY_SEVERE_CYCLONIC_STORM'
  | 'EXTREMELY_SEVERE_CYCLONIC_STORM'
  | 'SUPER_CYCLONIC_STORM';

export interface CycloneTrackPoint {
  id: string;
  type: 'OBSERVED' | 'FORECAST';
  timestamp: string; // ISO 8601
  timeIST: string;
  lat: number;
  lon: number;
  windKmh: number;
  windKnots: number;
  gustKmh: number;
  pressureHpa: number;
  classification: CycloneClassification;
  classificationLabel: string;
  coneRadiusKm?: number;
  advisoryNote?: string;
}

export interface CycloneEvent {
  id: string;
  name: string;
  basin: string;
  season: number;
  status: 'ACTIVE' | 'ARCHIVED';
  intensityLabel: string;
  maxClassification: CycloneClassification;
  maxWindKmh: number;
  maxWindKnots: number;
  minPressureHpa: number;
  bulletinTime: string;
  issuingAuthority: string;
  latestAdvisory: string;
  affectedRegions: string[];
  track: CycloneTrackPoint[];
  provenance: {
    agency: string;
    dataset: string;
    bulletinUrl?: string;
    lastUpdated: string;
  };
}

export const CLASSIFICATION_COLORS: Record<CycloneClassification, { bg: string; text: string; border: string; hex: string }> = {
  LOW_PRESSURE_AREA: { bg: 'bg-slate-500/20', text: 'text-slate-300', border: 'border-slate-500/50', hex: '#64748b' },
  DEPRESSION: { bg: 'bg-blue-500/20', text: 'text-blue-300', border: 'border-blue-500/50', hex: '#3b82f6' },
  DEEP_DEPRESSION: { bg: 'bg-cyan-500/20', text: 'text-cyan-300', border: 'border-cyan-500/50', hex: '#06b6d4' },
  CYCLONIC_STORM: { bg: 'bg-amber-500/20', text: 'text-amber-300', border: 'border-amber-500/50', hex: '#f59e0b' },
  SEVERE_CYCLONIC_STORM: { bg: 'bg-orange-500/20', text: 'text-orange-300', border: 'border-orange-500/50', hex: '#f97316' },
  VERY_SEVERE_CYCLONIC_STORM: { bg: 'bg-red-500/20', text: 'text-red-300', border: 'border-red-500/50', hex: '#ef4444' },
  EXTREMELY_SEVERE_CYCLONIC_STORM: { bg: 'bg-rose-500/20', text: 'text-rose-300', border: 'border-rose-500/50', hex: '#f43f5e' },
  SUPER_CYCLONIC_STORM: { bg: 'bg-purple-500/20', text: 'text-purple-300', border: 'border-purple-500/50', hex: '#a855f7' },
};

/**
 * Verified Historical Archive Storms from IMD Best Track Dataset
 * Strictly distinguishes historical archive data from live conditions.
 */
export const VERIFIED_HISTORICAL_CYCLONES: CycloneEvent[] = [
  {
    id: 'michaung-2023',
    name: 'Cyclone Michaung',
    basin: 'Bay of Bengal (North Indian Ocean)',
    season: 2023,
    status: 'ARCHIVED',
    intensityLabel: 'Severe Cyclonic Storm (SCS)',
    maxClassification: 'SEVERE_CYCLONIC_STORM',
    maxWindKmh: 110,
    maxWindKnots: 60,
    minPressureHpa: 982,
    bulletinTime: '2023-12-04T12:00:00Z',
    issuingAuthority: 'India Meteorological Department (RSMC New Delhi)',
    latestAdvisory: 'Severe Cyclonic Storm "MICHAUNG" centered over westcentral Bay of Bengal off south Andhra Pradesh and adjoining north Tamil Nadu coasts, tracking northward along coast delivering extreme precipitation exceeding 400 mm over Chennai metropolitan basin.',
    affectedRegions: ['Chennai', 'Tiruvallur', 'Kanchipuram', 'Bapatla', 'Nellore', 'Machilipatnam'],
    provenance: {
      agency: 'IMD Cyclone Warning Division / RSMC Tropical Cyclones New Delhi',
      dataset: 'RSMC New Delhi Annual Best Track Archive (Report No. 2023/12)',
      bulletinUrl: 'https://rsmcnewdelhi.imd.gov.in',
      lastUpdated: '2023-12-06T18:00:00Z',
    },
    track: [
      {
        id: 'mic-01',
        type: 'OBSERVED',
        timestamp: '2023-12-01T06:00:00Z',
        timeIST: '01 Dec 2023, 11:30 IST',
        lat: 9.5,
        lon: 86.0,
        windKmh: 45,
        windKnots: 25,
        gustKmh: 65,
        pressureHpa: 1002,
        classification: 'DEPRESSION',
        classificationLabel: 'Depression (D)',
        advisoryNote: 'Formed over south Andaman Sea and adjoining southeast Bay of Bengal.',
      },
      {
        id: 'mic-02',
        type: 'OBSERVED',
        timestamp: '2023-12-02T06:00:00Z',
        timeIST: '02 Dec 2023, 11:30 IST',
        lat: 10.6,
        lon: 84.8,
        windKmh: 55,
        windKnots: 30,
        gustKmh: 75,
        pressureHpa: 998,
        classification: 'DEEP_DEPRESSION',
        classificationLabel: 'Deep Depression (DD)',
        advisoryNote: 'Moved west-northwestward and intensified into a Deep Depression.',
      },
      {
        id: 'mic-03',
        type: 'OBSERVED',
        timestamp: '2023-12-03T06:00:00Z',
        timeIST: '03 Dec 2023, 11:30 IST',
        lat: 11.8,
        lon: 83.2,
        windKmh: 75,
        windKnots: 40,
        gustKmh: 95,
        pressureHpa: 992,
        classification: 'CYCLONIC_STORM',
        classificationLabel: 'Cyclonic Storm (CS)',
        advisoryNote: 'Upgraded to Cyclonic Storm "Michaung" over southwest Bay of Bengal.',
      },
      {
        id: 'mic-04',
        type: 'OBSERVED',
        timestamp: '2023-12-04T00:00:00Z',
        timeIST: '04 Dec 2023, 05:30 IST',
        lat: 13.2,
        lon: 81.2,
        windKmh: 100,
        windKnots: 55,
        gustKmh: 120,
        pressureHpa: 986,
        classification: 'SEVERE_CYCLONIC_STORM',
        classificationLabel: 'Severe Cyclonic Storm (SCS)',
        advisoryNote: 'Intensified into Severe Cyclonic Storm. Eyewall rainbands battering Chennai coast.',
      },
      {
        id: 'mic-05',
        type: 'OBSERVED',
        timestamp: '2023-12-04T12:00:00Z',
        timeIST: '04 Dec 2023, 17:30 IST',
        lat: 13.9,
        lon: 80.5,
        windKmh: 110,
        windKnots: 60,
        gustKmh: 125,
        pressureHpa: 982,
        classification: 'SEVERE_CYCLONIC_STORM',
        classificationLabel: 'Severe Cyclonic Storm (SCS)',
        advisoryNote: 'Peak intensity off north Tamil Nadu / south Andhra Pradesh coast. Stalled 90 km east of Chennai.',
      },
      {
        id: 'mic-06',
        type: 'OBSERVED',
        timestamp: '2023-12-05T06:00:00Z',
        timeIST: '05 Dec 2023, 11:30 IST',
        lat: 15.5,
        lon: 80.2,
        windKmh: 100,
        windKnots: 55,
        gustKmh: 115,
        pressureHpa: 988,
        classification: 'SEVERE_CYCLONIC_STORM',
        classificationLabel: 'Severe Cyclonic Storm (SCS)',
        advisoryNote: 'Landfall commenced south of Bapatla, Andhra Pradesh coast.',
      },
      {
        id: 'mic-07',
        type: 'FORECAST',
        timestamp: '2023-12-05T18:00:00Z',
        timeIST: '05 Dec 2023, 23:30 IST',
        lat: 16.6,
        lon: 80.8,
        windKmh: 65,
        windKnots: 35,
        gustKmh: 80,
        pressureHpa: 996,
        classification: 'CYCLONIC_STORM',
        classificationLabel: 'Cyclonic Storm (CS)',
        coneRadiusKm: 60,
        advisoryNote: 'Post-landfall rapid weakening over coastal Andhra Pradesh.',
      },
      {
        id: 'mic-08',
        type: 'FORECAST',
        timestamp: '2023-12-06T06:00:00Z',
        timeIST: '06 Dec 2023, 11:30 IST',
        lat: 17.8,
        lon: 81.9,
        windKmh: 45,
        windKnots: 25,
        gustKmh: 60,
        pressureHpa: 1002,
        classification: 'DEPRESSION',
        classificationLabel: 'Depression (D)',
        coneRadiusKm: 120,
        advisoryNote: 'Weakened to depression over northern Andhra Pradesh and adjoining Telangana.',
      },
    ],
  },
  {
    id: 'remal-2024',
    name: 'Cyclone Remal',
    basin: 'Bay of Bengal (North Indian Ocean)',
    season: 2024,
    status: 'ARCHIVED',
    intensityLabel: 'Severe Cyclonic Storm (SCS)',
    maxClassification: 'SEVERE_CYCLONIC_STORM',
    maxWindKmh: 115,
    maxWindKnots: 62,
    minPressureHpa: 978,
    bulletinTime: '2024-05-26T18:00:00Z',
    issuingAuthority: 'India Meteorological Department (RSMC New Delhi)',
    latestAdvisory: 'Severe Cyclonic Storm "REMAL" crossed West Bengal and adjoining Bangladesh coasts between Sagar Island and Khepupara with wind speeds of 110-120 km/h gusting to 135 km/h.',
    affectedRegions: ['Kolkata', 'Sundarbans', 'South 24 Parganas', 'North 24 Parganas', 'Khepupara'],
    provenance: {
      agency: 'IMD Cyclone Warning Division / RSMC Tropical Cyclones New Delhi',
      dataset: 'RSMC New Delhi Best Track Report (May 2024)',
      bulletinUrl: 'https://rsmcnewdelhi.imd.gov.in',
      lastUpdated: '2024-05-28T12:00:00Z',
    },
    track: [
      {
        id: 'rem-01',
        type: 'OBSERVED',
        timestamp: '2024-05-24T12:00:00Z',
        timeIST: '24 May 2024, 17:30 IST',
        lat: 17.5,
        lon: 89.2,
        windKmh: 45,
        windKnots: 25,
        gustKmh: 65,
        pressureHpa: 1000,
        classification: 'DEPRESSION',
        classificationLabel: 'Depression (D)',
        advisoryNote: 'Formed over central and adjoining south Bay of Bengal.',
      },
      {
        id: 'rem-02',
        type: 'OBSERVED',
        timestamp: '2024-05-25T06:00:00Z',
        timeIST: '25 May 2024, 11:30 IST',
        lat: 18.8,
        lon: 89.5,
        windKmh: 60,
        windKnots: 32,
        gustKmh: 80,
        pressureHpa: 996,
        classification: 'DEEP_DEPRESSION',
        classificationLabel: 'Deep Depression (DD)',
        advisoryNote: 'Concentrated into Deep Depression moving nearly northwards.',
      },
      {
        id: 'rem-03',
        type: 'OBSERVED',
        timestamp: '2024-05-25T18:00:00Z',
        timeIST: '25 May 2024, 23:30 IST',
        lat: 19.8,
        lon: 89.6,
        windKmh: 75,
        windKnots: 40,
        gustKmh: 95,
        pressureHpa: 990,
        classification: 'CYCLONIC_STORM',
        classificationLabel: 'Cyclonic Storm (CS)',
        advisoryNote: 'Intensified into Cyclonic Storm "Remal" over eastcentral Bay of Bengal.',
      },
      {
        id: 'rem-04',
        type: 'OBSERVED',
        timestamp: '2024-05-26T06:00:00Z',
        timeIST: '26 May 2024, 11:30 IST',
        lat: 20.8,
        lon: 89.4,
        windKmh: 105,
        windKnots: 57,
        gustKmh: 125,
        pressureHpa: 982,
        classification: 'SEVERE_CYCLONIC_STORM',
        classificationLabel: 'Severe Cyclonic Storm (SCS)',
        advisoryNote: 'Rapid intensification into Severe Cyclonic Storm heading towards Sundarbans delta.',
      },
      {
        id: 'rem-05',
        type: 'OBSERVED',
        timestamp: '2024-05-26T18:00:00Z',
        timeIST: '26 May 2024, 23:30 IST',
        lat: 21.9,
        lon: 89.2,
        windKmh: 115,
        windKnots: 62,
        gustKmh: 135,
        pressureHpa: 978,
        classification: 'SEVERE_CYCLONIC_STORM',
        classificationLabel: 'Severe Cyclonic Storm (SCS)',
        advisoryNote: 'Landfall over West Bengal and adjoining Bangladesh coast between Sagar Island & Khepupara.',
      },
      {
        id: 'rem-06',
        type: 'FORECAST',
        timestamp: '2024-05-27T06:00:00Z',
        timeIST: '27 May 2024, 11:30 IST',
        lat: 23.4,
        lon: 89.8,
        windKmh: 70,
        windKnots: 38,
        gustKmh: 90,
        pressureHpa: 990,
        classification: 'CYCLONIC_STORM',
        classificationLabel: 'Cyclonic Storm (CS)',
        coneRadiusKm: 70,
        advisoryNote: 'Weakening while crossing southern Bangladesh and West Bengal.',
      },
      {
        id: 'rem-07',
        type: 'FORECAST',
        timestamp: '2024-05-27T18:00:00Z',
        timeIST: '27 May 2024, 23:30 IST',
        lat: 24.8,
        lon: 91.0,
        windKmh: 45,
        windKnots: 25,
        gustKmh: 65,
        pressureHpa: 998,
        classification: 'DEPRESSION',
        classificationLabel: 'Depression (D)',
        coneRadiusKm: 140,
        advisoryNote: 'Dissipating into depression over Meghalaya and Assam foothills.',
      },
    ],
  },
];
