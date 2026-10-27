import {
  HydrodynamicSimulationRequest,
  HydrodynamicSimulationOutput,
  EXPERIMENTAL_MODEL_DISCLAIMER,
  OutputClassification,
} from '../types/hydrodynamic.types.js';

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

export class HydrodynamicContractService {
  /**
   * Validates an incoming simulation request against strict numerical and physical boundary rules.
   */
  public static validateRequest(request: unknown): ValidationResult {
    const errors: string[] = [];

    if (!request || typeof request !== 'object') {
      return { isValid: false, errors: ['Request payload must be a non-null object.'] };
    }

    const req = request as Partial<HydrodynamicSimulationRequest>;

    // 1. Identity & Sector
    if (!req.simulationId || typeof req.simulationId !== 'string') {
      errors.push('Missing or invalid "simulationId".');
    }
    if (!req.sectorId || typeof req.sectorId !== 'string') {
      errors.push('Missing or invalid "sectorId".');
    }

    // 2. Engine and Version
    const validEngines = ['HEC_RAS_2D', 'LISFLOOD_FP', 'SFINCS', 'TUFLOW', 'TELEMAC_2D'];
    if (!req.modelEngine || !validEngines.includes(req.modelEngine)) {
      errors.push(`Invalid "modelEngine". Allowed engines: ${validEngines.join(', ')}.`);
    }
    if (!req.modelVersion || typeof req.modelVersion !== 'string') {
      errors.push('Missing or invalid "modelVersion".');
    }

    // 3. Terrain validation
    if (!req.terrain || typeof req.terrain !== 'object') {
      errors.push('Missing "terrain" configuration block.');
    } else {
      if (!req.terrain.demId || typeof req.terrain.demId !== 'string') {
        errors.push('Missing "terrain.demId".');
      }
      if (
        typeof req.terrain.demResolutionMeters !== 'number' ||
        req.terrain.demResolutionMeters <= 0 ||
        req.terrain.demResolutionMeters > 1000
      ) {
        errors.push('"terrain.demResolutionMeters" must be a positive number between 0.1m and 1000m.');
      }
      if (!req.terrain.crs || !req.terrain.crs.startsWith('EPSG:')) {
        errors.push('"terrain.crs" must be a valid EPSG projected coordinate system (e.g., EPSG:32643).');
      }
      if (!req.terrain.roughness) {
        errors.push('Missing "terrain.roughness" parameter object.');
      } else {
        if (
          typeof req.terrain.roughness.defaultChannel !== 'number' ||
          req.terrain.roughness.defaultChannel < 0.01 ||
          req.terrain.roughness.defaultChannel > 0.3
        ) {
          errors.push('"terrain.roughness.defaultChannel" Manning\'s n must be between 0.01 and 0.30.');
        }
        if (
          typeof req.terrain.roughness.defaultFloodplain !== 'number' ||
          req.terrain.roughness.defaultFloodplain < 0.01 ||
          req.terrain.roughness.defaultFloodplain > 0.3
        ) {
          errors.push('"terrain.roughness.defaultFloodplain" Manning\'s n must be between 0.01 and 0.30.');
        }
      }
    }

    // 4. Boundary conditions validation
    if (!req.boundaries || typeof req.boundaries !== 'object') {
      errors.push('Missing "boundaries" configuration block.');
    } else {
      if (!Array.isArray(req.boundaries.rainfallTimeseries) || req.boundaries.rainfallTimeseries.length === 0) {
        errors.push('"boundaries.rainfallTimeseries" must be a non-empty array of rainfall points.');
      } else {
        for (let i = 0; i < req.boundaries.rainfallTimeseries.length; i++) {
          const pt = req.boundaries.rainfallTimeseries[i];
          if (typeof pt.intensityMmH !== 'number' || pt.intensityMmH < 0 || isNaN(pt.intensityMmH)) {
            errors.push(`Rainfall point at index ${i} has invalid intensity (${pt.intensityMmH} mm/h).`);
            break;
          }
        }
      }
    }

    // 5. Time window validation
    if (!req.timeWindow || typeof req.timeWindow !== 'object') {
      errors.push('Missing "timeWindow" configuration block.');
    } else {
      const start = new Date(req.timeWindow.startTime).getTime();
      const end = new Date(req.timeWindow.endTime).getTime();
      if (isNaN(start) || isNaN(end) || end <= start) {
        errors.push('Invalid time window: "endTime" must be strictly greater than "startTime".');
      }
      if (
        typeof req.timeWindow.timestepSeconds !== 'number' ||
        req.timeWindow.timestepSeconds <= 0 ||
        req.timeWindow.timestepSeconds > 3600
      ) {
        errors.push('"timeWindow.timestepSeconds" must be between 1 and 3600 seconds.');
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Validates an output from a modeling engine and enforces safety disclaimers and classifications.
   */
  public static validateAndSanitizeOutput(output: unknown): {
    isValid: boolean;
    errors: string[];
    sanitized?: HydrodynamicSimulationOutput;
  } {
    const errors: string[] = [];

    if (!output || typeof output !== 'object') {
      return { isValid: false, errors: ['Output payload must be a non-null object.'] };
    }

    const out = output as Partial<HydrodynamicSimulationOutput>;

    if (!out.outputId) errors.push('Missing "outputId".');
    if (!out.jobId) errors.push('Missing "jobId".');
    if (!out.sectorId) errors.push('Missing "sectorId".');

    // Metrics validation
    if (!out.metrics || typeof out.metrics !== 'object') {
      errors.push('Missing "metrics" object.');
    } else {
      if (typeof out.metrics.peakDepthMeters !== 'number' || out.metrics.peakDepthMeters < 0) {
        errors.push('"metrics.peakDepthMeters" must be a non-negative number.');
      }
      if (typeof out.metrics.maxInundationExtentKm2 !== 'number' || out.metrics.maxInundationExtentKm2 < 0) {
        errors.push('"metrics.maxInundationExtentKm2" must be a non-negative number.');
      }
    }

    // Mandatory experimental classification safety rule
    // Unless an explicit formal validation proof is attached with a CSI >= 0.70, it must be marked EXPERIMENTAL
    let classification: OutputClassification = 'EXPERIMENTAL_UNVALIDATED';
    if (out.uncertainty && typeof out.uncertainty.criticalSuccessIndex === 'number') {
      if (out.uncertainty.criticalSuccessIndex >= 0.70 && out.uncertainty.calibrationDataset) {
        classification = out.classification === 'OPERATIONAL_ADVISORY' ? 'OPERATIONAL_ADVISORY' : 'VALIDATED_PILOT';
      }
    }

    if (errors.length > 0) {
      return { isValid: false, errors };
    }

    const sanitized: HydrodynamicSimulationOutput = {
      outputId: out.outputId!,
      jobId: out.jobId!,
      simulationId: out.simulationId || `SIM-${Date.now()}`,
      sectorId: out.sectorId!,
      simulationTimestamp: out.simulationTimestamp || new Date().toISOString(),
      spatialReferenceSystem: out.spatialReferenceSystem || 'EPSG:4326',
      classification,
      disclaimer: classification === 'OPERATIONAL_ADVISORY' 
        ? 'CALIBRATED SIMULATION ADVISORY: Hydrodynamic prediction calibrated against historical event records.'
        : EXPERIMENTAL_MODEL_DISCLAIMER,
      metrics: {
        maxInundationExtentKm2: out.metrics!.maxInundationExtentKm2,
        peakDepthMeters: out.metrics!.peakDepthMeters,
        peakVelocityMs: out.metrics!.peakVelocityMs,
        depthTiers: Array.isArray(out.metrics!.depthTiers) ? out.metrics!.depthTiers : [],
      },
      inundationPolygonsGeoJSON: out.inundationPolygonsGeoJSON,
      rasterCoverageTileUrl: out.rasterCoverageTileUrl,
      uncertainty: {
        depthErrorMarginMeters: out.uncertainty?.depthErrorMarginMeters ?? 0.5,
        confidencePercentile: out.uncertainty?.confidencePercentile ?? 50,
        calibrationDataset: out.uncertainty?.calibrationDataset,
        criticalSuccessIndex: out.uncertainty?.criticalSuccessIndex,
      },
      provenance: {
        engineName: out.provenance?.engineName || 'HEC_RAS_2D',
        engineVersion: out.provenance?.engineVersion || 'unknown',
        demSource: out.provenance?.demSource || 'Unspecified DEM',
        meteorologicalDriver: out.provenance?.meteorologicalDriver || 'Unspecified Weather Input',
        gridCellCount: out.provenance?.gridCellCount || 0,
        computationDurationSeconds: out.provenance?.computationDurationSeconds || 0,
        storageUri: out.provenance?.storageUri || 'memory://',
        checksumSha256: out.provenance?.checksumSha256 || '0000000000000000000000000000000000000000000000000000000000000000',
      },
    };

    return {
      isValid: true,
      errors: [],
      sanitized,
    };
  }

  /**
   * Gatekeeper rule: determines if an output can be merged into official command decisions.
   * Returns false unless rigorous empirical ground-truth validation is proven.
   */
  public static isEligibleForOperationalDirectives(output: HydrodynamicSimulationOutput): boolean {
    if (output.classification === 'EXPERIMENTAL_UNVALIDATED') {
      return false;
    }
    if (!output.uncertainty || typeof output.uncertainty.criticalSuccessIndex !== 'number') {
      return false;
    }
    // High-stakes threshold: CSI >= 0.70 and depth error margin <= 0.35m
    return (
      output.uncertainty.criticalSuccessIndex >= 0.70 &&
      output.uncertainty.depthErrorMarginMeters <= 0.35
    );
  }
}
