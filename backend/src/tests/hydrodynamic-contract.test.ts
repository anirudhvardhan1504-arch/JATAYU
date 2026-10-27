import { describe, it, expect } from 'vitest';
import {
  HydrodynamicContractService,
} from '../services/hydrodynamic-contract.service.js';
import {
  HydrodynamicSimulationRequest,
  HydrodynamicSimulationOutput,
  EXPERIMENTAL_MODEL_DISCLAIMER,
} from '../types/hydrodynamic.types.js';

describe('Hydrodynamic Modeling Integration Contract Tests (Phase 2H)', () => {
  const validRequest: HydrodynamicSimulationRequest = {
    simulationId: 'SIM-2026-MUM-001',
    sectorId: 'SEC-MUM-01',
    modelEngine: 'HEC_RAS_2D',
    modelVersion: '6.4.1',
    terrain: {
      demId: 'DEM-MUM-CARTODEM-30M',
      demResolutionMeters: 30.0,
      crs: 'EPSG:32643', // UTM Zone 43N for Mumbai
      elevationDatum: 'EGM2008',
      roughness: {
        defaultChannel: 0.035,
        defaultFloodplain: 0.060,
      },
    },
    boundaries: {
      rainfallTimeseries: [
        { timestamp: '2026-10-25T06:00:00Z', intensityMmH: 15.0 },
        { timestamp: '2026-10-25T07:00:00Z', intensityMmH: 45.0 },
        { timestamp: '2026-10-25T08:00:00Z', intensityMmH: 20.0 },
      ],
      inflowHydrographs: [
        { riverId: 'MITHI_RIVER_MAIN', nodeIndex: 1, dischargeM3s: 180.5, timestamp: '2026-10-25T07:00:00Z' },
      ],
      tidalDownstreamBoundary: [
        { stationId: 'MAHIM_BAY_TIDE', waterLevelMslMeters: 2.1, timestamp: '2026-10-25T07:00:00Z' },
      ],
    },
    timeWindow: {
      startTime: '2026-10-25T06:00:00Z',
      endTime: '2026-10-25T12:00:00Z',
      timestepSeconds: 15,
      outputIntervalMinutes: 15,
    },
    requestedOutputs: ['WATER_DEPTH', 'VELOCITY_VECTOR', 'INUNDATION_EXTENT'],
    requesterId: 'usr_researcher_001',
  };

  describe('1. Simulation Request Validation', () => {
    it('validates a complete, structurally and physically sound simulation request', () => {
      const result = HydrodynamicContractService.validateRequest(validRequest);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('rejects request with missing or invalid simulation identity and sector', () => {
      const bad = { ...validRequest, simulationId: '', sectorId: '' };
      const result = HydrodynamicContractService.validateRequest(bad);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Missing or invalid "simulationId".');
      expect(result.errors).toContain('Missing or invalid "sectorId".');
    });

    it('rejects unsupported or unvalidated modeling engines', () => {
      const bad = { ...validRequest, modelEngine: 'UNSUPPORTED_AI_BLACKBOX' as any };
      const result = HydrodynamicContractService.validateRequest(bad);
      expect(result.isValid).toBe(false);
      expect(result.errors[0]).toMatch(/Invalid "modelEngine"/);
    });

    it('enforces projected metric CRS and positive resolution bounds', () => {
      const badCrs = {
        ...validRequest,
        terrain: {
          ...validRequest.terrain,
          crs: 'WGS84_UNPROJECTED_DEGREES',
          demResolutionMeters: -5,
        },
      };
      const result = HydrodynamicContractService.validateRequest(badCrs);
      expect(result.isValid).toBe(false);
      expect(result.errors.some((e) => e.includes('demResolutionMeters'))).toBe(true);
      expect(result.errors.some((e) => e.includes('EPSG projected coordinate system'))).toBe(true);
    });

    it('rejects unphysical Manning roughness coefficients', () => {
      const badRoughness = {
        ...validRequest,
        terrain: {
          ...validRequest.terrain,
          roughness: {
            defaultChannel: 0.001, // Unphysically smooth
            defaultFloodplain: 0.85, // Unphysically rough
          },
        },
      };
      const result = HydrodynamicContractService.validateRequest(badRoughness);
      expect(result.isValid).toBe(false);
      expect(result.errors.some((e) => e.includes('defaultChannel'))).toBe(true);
      expect(result.errors.some((e) => e.includes('defaultFloodplain'))).toBe(true);
    });

    it('rejects inverted or equal simulation time windows', () => {
      const badTime = {
        ...validRequest,
        timeWindow: {
          ...validRequest.timeWindow,
          startTime: '2026-10-25T12:00:00Z',
          endTime: '2026-10-25T06:00:00Z', // Inverted
        },
      };
      const result = HydrodynamicContractService.validateRequest(badTime);
      expect(result.isValid).toBe(false);
      expect(result.errors.some((e) => e.includes('endTime" must be strictly greater than "startTime"'))).toBe(true);
    });

    it('rejects negative rainfall intensities', () => {
      const badRain = {
        ...validRequest,
        boundaries: {
          rainfallTimeseries: [{ timestamp: '2026-10-25T06:00:00Z', intensityMmH: -12.5 }],
        },
      };
      const result = HydrodynamicContractService.validateRequest(badRain);
      expect(result.isValid).toBe(false);
      expect(result.errors.some((e) => e.includes('invalid intensity'))).toBe(true);
    });
  });

  describe('2. Model Output Validation & Experimental Safety Rules', () => {
    it('mandates EXPERIMENTAL_UNVALIDATED classification when no empirical ground-truth proof is attached', () => {
      const rawOutput = {
        outputId: 'OUT-2026-001',
        jobId: 'JOB-001',
        simulationId: 'SIM-2026-MUM-001',
        sectorId: 'SEC-MUM-01',
        metrics: {
          maxInundationExtentKm2: 42.8,
          peakDepthMeters: 2.3,
        },
        uncertainty: {
          depthErrorMarginMeters: 0.8,
          confidencePercentile: 50,
          // Note: No criticalSuccessIndex or calibrationDataset!
        },
      };

      const result = HydrodynamicContractService.validateAndSanitizeOutput(rawOutput);
      expect(result.isValid).toBe(true);
      expect(result.sanitized?.classification).toBe('EXPERIMENTAL_UNVALIDATED');
      expect(result.sanitized?.disclaimer).toBe(EXPERIMENTAL_MODEL_DISCLAIMER);
    });

    it('allows promotion to VALIDATED_PILOT when empirical calibration with CSI >= 0.70 is documented', () => {
      const validatedOutput = {
        outputId: 'OUT-2026-002',
        jobId: 'JOB-002',
        simulationId: 'SIM-2026-MUM-002',
        sectorId: 'SEC-MUM-01',
        metrics: {
          maxInundationExtentKm2: 38.5,
          peakDepthMeters: 1.8,
        },
        uncertainty: {
          depthErrorMarginMeters: 0.28,
          confidencePercentile: 90,
          calibrationDataset: 'Historical July 2005 Mumbai Gauge & High-Water Mark Benchmark (MCGM)',
          criticalSuccessIndex: 0.78, // Verified >= 0.70
        },
      };

      const result = HydrodynamicContractService.validateAndSanitizeOutput(validatedOutput);
      expect(result.isValid).toBe(true);
      expect(result.sanitized?.classification).toBe('VALIDATED_PILOT');
    });

    it('prohibits unvalidated experimental models from driving operational directives', () => {
      const experimentalOutput: HydrodynamicSimulationOutput = {
        outputId: 'OUT-EXP-001',
        jobId: 'JOB-001',
        simulationId: 'SIM-001',
        sectorId: 'SEC-MUM-01',
        simulationTimestamp: new Date().toISOString(),
        spatialReferenceSystem: 'EPSG:4326',
        classification: 'EXPERIMENTAL_UNVALIDATED',
        disclaimer: EXPERIMENTAL_MODEL_DISCLAIMER,
        metrics: {
          maxInundationExtentKm2: 50,
          peakDepthMeters: 2.5,
          depthTiers: [],
        },
        uncertainty: {
          depthErrorMarginMeters: 0.9,
          confidencePercentile: 50,
        },
        provenance: {
          engineName: 'HEC_RAS_2D',
          engineVersion: '6.4.1',
          demSource: 'Copernicus 30m',
          meteorologicalDriver: 'Open-Meteo GFS',
          gridCellCount: 100000,
          computationDurationSeconds: 120,
          storageUri: 's3://jatayu-models/sim-001.tif',
          checksumSha256: 'abc123',
        },
      };

      const isEligible = HydrodynamicContractService.isEligibleForOperationalDirectives(experimentalOutput);
      expect(isEligible).toBe(false);
    });

    it('grants operational directive eligibility only when both CSI >= 0.70 and depth error <= 0.35m are satisfied', () => {
      const candidate: HydrodynamicSimulationOutput = {
        outputId: 'OUT-VAL-001',
        jobId: 'JOB-002',
        simulationId: 'SIM-002',
        sectorId: 'SEC-MUM-01',
        simulationTimestamp: new Date().toISOString(),
        spatialReferenceSystem: 'EPSG:4326',
        classification: 'OPERATIONAL_ADVISORY',
        disclaimer: 'CALIBRATED SIMULATION ADVISORY',
        metrics: {
          maxInundationExtentKm2: 30,
          peakDepthMeters: 1.4,
          depthTiers: [],
        },
        uncertainty: {
          depthErrorMarginMeters: 0.30, // <= 0.35m
          confidencePercentile: 90,
          calibrationDataset: 'Historical Event Calibration',
          criticalSuccessIndex: 0.76, // >= 0.70
        },
        provenance: {
          engineName: 'HEC_RAS_2D',
          engineVersion: '6.4.1',
          demSource: 'LiDAR 1m / CartoDEM 10m',
          meteorologicalDriver: 'IMD DWR QPE Gridded',
          gridCellCount: 500000,
          computationDurationSeconds: 450,
          storageUri: 's3://jatayu-models/sim-002.tif',
          checksumSha256: 'def456',
        },
      };

      expect(HydrodynamicContractService.isEligibleForOperationalDirectives(candidate)).toBe(true);

      // Fails if CSI is too low
      const lowCsi = { ...candidate, uncertainty: { ...candidate.uncertainty, criticalSuccessIndex: 0.62 } };
      expect(HydrodynamicContractService.isEligibleForOperationalDirectives(lowCsi)).toBe(false);

      // Fails if depth error margin is too high (> 0.35m)
      const highDepthErr = { ...candidate, uncertainty: { ...candidate.uncertainty, depthErrorMarginMeters: 0.55 } };
      expect(HydrodynamicContractService.isEligibleForOperationalDirectives(highDepthErr)).toBe(false);
    });
  });
});
