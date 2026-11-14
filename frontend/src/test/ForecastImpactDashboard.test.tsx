import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ForecastImpactDashboard } from '../components/map/ForecastImpactDashboard';
import * as impactService from '../services/forecast-impact';
import type { ForecastImpactResponse } from '../services/forecast-impact';

describe('ForecastImpactDashboard Component (Phase 3D-2A)', () => {
  const mockResponse: ForecastImpactResponse = {
    metadata: {
      provider: 'Open-Meteo ECMWF Open Data',
      model: 'ECMWF IFS (0.25°)',
      nativeResolution: '0.25° regular lat/lon',
      gridSamplingResolution: '0.25° (~27 km spacing)',
      initializationTime: '2026-11-13T00:00:00.000Z',
      runCycle: '00Z',
      validStartTime: '2026-11-13T01:00:00.000Z',
      validEndTime: '2026-11-16T00:00:00.000Z',
      generatedAt: '2026-11-13T00:05:00.000Z',
      mode: 'sector',
      activeSector: 'chennai',
      isFallback: false,
      isStale: false,
      scientificDisclaimer: 'Meteorological hazard forecast only; does NOT simulate hydraulic inundation or urban drainage failure.',
      dataQualityDisclaimer: 'District summaries are aggregated from NWP grid nodes within polygon boundaries.',
      accumulationConvention: 'Future accumulations represent prospective rainfall from validStartTime (T+1). T+0 analysis hour is excluded.',
    },
    summary: {
      districtsEvaluated: 3,
      districtsWithSufficientCoverage: 2,
      districtsInHeavyOrAbove: 2,
      districtsInVeryHeavyOrAbove: 1,
      districtsInExtremelyHeavy: 0,
      topImpactedDistricts: [],
    },
    districts: [
      {
        district: 'CHENNAI',
        state: 'TAMIL NADU',
        censusCode: '603',
        coverage: {
          status: 'SUFFICIENT_MESOSCALE',
          spatialDensity: 'SINGLE_NODE_LOCALIZED',
          nodeCount: 1,
          method: 'POLYGON_INTERIOR',
          coverageNotice: 'District estimate relies on a single interior NWP node. Microclimatic variability is unrepresented.',
        },
        metrics: {
          futureAccum6hMm: 15.2,
          futureAccum12hMm: 38.6,
          futureAccum24hMm: 75.4,
          futureAccum48hMm: 92.1,
          futureAccum72hMm: null, // Open-Meteo 71 future steps -> 72h is null
          accum72hQualityReason: 'Upstream NWP dataset provides 71 future hourly intervals (T+1..T+71). 72h metric withheld.',
          peakHourlyRateMmH: 12.8,
          peakHourlyTimeUtc: '2026-11-13T14:00:00.000Z',
          peakHourlyRateCategory: 'MODERATE',
          maxWindGustKmh: 48.5,
        },
        dataQuality: {
          isComplete: true,
          totalExpectedHours: 71,
          totalAvailableHours: 71,
          continuityValid: true,
        },
        classification: {
          imdRainfallCategory: 'HEAVY_RAIN',
          thresholdDefinition: '64.5 mm to 115.5 mm within prospective 24-hour window',
          officialImdAlert: {
            severity: 'WARNING',
            color: 'ORANGE',
            headline: 'Heavy rainfall warning for coastal districts of Tamil Nadu',
            issuedAt: '2026-11-13T06:00:00.000Z',
          },
        },
        localExposure: {
          verifiedEmergencyFacilitiesCount: 14,
          facilityTypes: {
            hospitals: 6,
            shelters: 5,
            fireStations: 3,
            other: 0,
          },
          chennaiHistoricalChokepointsCount: 6,
          exposureNotice: 'Geographic co-location in district does NOT imply physical inundation, hydraulic flooding, or structural damage.',
        },
      },
      {
        district: 'KANCHIPURAM',
        state: 'TAMIL NADU',
        censusCode: '604',
        coverage: {
          status: 'SUFFICIENT_MESOSCALE',
          spatialDensity: 'MULTI_NODE_REPRESENTATIVE',
          nodeCount: 3,
          method: 'POLYGON_INTERIOR',
        },
        metrics: {
          futureAccum6hMm: 22.0,
          futureAccum12hMm: 55.0,
          futureAccum24hMm: 120.5,
          futureAccum48hMm: 140.0,
          futureAccum72hMm: null,
          accum72hQualityReason: 'Upstream NWP dataset provides 71 future hourly intervals.',
          peakHourlyRateMmH: 18.5,
          peakHourlyTimeUtc: '2026-11-13T16:00:00.000Z',
          peakHourlyRateCategory: 'HEAVY',
          maxWindGustKmh: 55.0,
        },
        dataQuality: {
          isComplete: true,
          totalExpectedHours: 71,
          totalAvailableHours: 71,
          continuityValid: true,
        },
        classification: {
          imdRainfallCategory: 'VERY_HEAVY_RAIN',
          thresholdDefinition: '115.6 mm to 204.4 mm within prospective 24-hour window',
        },
        localExposure: {
          verifiedEmergencyFacilitiesCount: 8,
          facilityTypes: {
            hospitals: 3,
            shelters: 4,
            fireStations: 1,
            other: 0,
          },
          exposureNotice: 'Geographic co-location in district does NOT imply physical inundation, hydraulic flooding, or structural damage.',
        },
      },
      {
        district: 'REMOTE ENCLAVE',
        state: 'TAMIL NADU',
        coverage: {
          status: 'INSUFFICIENT_DATA',
          spatialDensity: 'UNREPRESENTED',
          nodeCount: 0,
          method: 'NONE',
        },
        metrics: {
          futureAccum6hMm: null,
          futureAccum12hMm: null,
          futureAccum24hMm: null,
          futureAccum48hMm: null,
          futureAccum72hMm: null,
          peakHourlyRateMmH: null,
          peakHourlyTimeUtc: null,
          peakHourlyRateCategory: 'NEGLIGIBLE',
          maxWindGustKmh: null,
        },
        dataQuality: {
          isComplete: false,
          totalExpectedHours: 71,
          totalAvailableHours: 0,
          continuityValid: false,
          qualityNotice: 'No grid nodes intersect this district boundary.',
        },
        classification: {
          imdRainfallCategory: 'NO_RAIN',
          thresholdDefinition: 'No rain or quantitative forecast data unavailable',
        },
        localExposure: {
          verifiedEmergencyFacilitiesCount: 0,
          facilityTypes: {
            hospitals: 0,
            shelters: 0,
            fireStations: 0,
            other: 0,
          },
          exposureNotice: 'Geographic co-location in district does NOT imply physical inundation, hydraulic flooding, or structural damage.',
        },
      },
    ],
  };

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(impactService, 'getForecastImpact').mockResolvedValue(mockResponse);
  });

  it('does not render when isOpen is false', () => {
    render(<ForecastImpactDashboard isOpen={false} onClose={() => {}} />);
    expect(screen.queryByText(/FORECAST IMPACT INTELLIGENCE/i)).toBeNull();
  });

  it('renders header, NWP model provenance, badge, and disclaimer when open', async () => {
    render(<ForecastImpactDashboard isOpen={true} onClose={() => {}} activeSectorKey="chennai" />);

    await waitFor(() => {
      expect(screen.getByText(/FORECAST IMPACT INTELLIGENCE/i)).toBeDefined();
    });

    // NWP 72H FORECAST WINDOW badge
    expect(screen.getByText('NWP 72H FORECAST WINDOW')).toBeDefined();

    // Model and run cycle
    expect(screen.getByText('ECMWF IFS')).toBeDefined();
    expect(screen.getByText('00Z CYCLE')).toBeDefined();
    expect(screen.getByText('Open-Meteo ECMWF Open Data')).toBeDefined();

    // Distinguish model, native unverified, provider output grid, and JATAYU sampling
    expect(screen.getByText(/Unavailable \(unverified from upstream metadata\)/i)).toBeDefined();
    expect(screen.getByText('0.25° regular lat/lon')).toBeDefined();
    expect(screen.getByText('0.25° (~27 km spacing)')).toBeDefined();

    // Operational disclaimer & accumulation semantics
    expect(screen.getByText(/Meteorological hazard forecast only; does NOT simulate hydraulic inundation/i)).toBeDefined();
    expect(screen.getByText(/Accumulation Horizon Semantics:/i)).toBeDefined();
  });

  it('renders mode-dependent KPI summary cards with scientifically accurate descriptions in sector mode', async () => {
    render(<ForecastImpactDashboard isOpen={true} onClose={() => {}} activeSectorKey="chennai" />);

    await waitFor(() => {
      expect(screen.getAllByText('3').length).toBeGreaterThanOrEqual(1); // Evaluated
      expect(screen.getByText('SUFFICIENT MESOSCALE COVERAGE')).toBeDefined();
      expect(screen.getByText(/Mesoscale NWP Sampling \(0\.25° Grid; ~28 km nominal spacing\)/i)).toBeDefined();
      expect(screen.getAllByText('2').length).toBe(2); // Sufficient mesoscale coverage & Heavy or above
    });
  });

  it('renders mode-dependent KPI summary cards with indicative synoptic description in national mode', async () => {
    const nationalResponse: ForecastImpactResponse = {
      ...mockResponse,
      metadata: {
        ...mockResponse.metadata,
        mode: 'national',
        activeSector: undefined,
        gridSamplingResolution: '1.5° (~160 km) National Synoptic Macro-Mesh',
      },
      districts: [
        {
          ...mockResponse.districts[0],
          coverage: {
            ...mockResponse.districts[0].coverage,
            status: 'SYNOPTIC_INDICATIVE',
          },
        },
        {
          ...mockResponse.districts[1],
          coverage: {
            ...mockResponse.districts[1].coverage,
            status: 'SYNOPTIC_INDICATIVE',
          },
        },
        {
          ...mockResponse.districts[2],
          coverage: {
            ...mockResponse.districts[2].coverage,
            status: 'INSUFFICIENT_DATA',
          },
        },
      ],
    };

    vi.spyOn(impactService, 'getForecastImpact').mockResolvedValue(nationalResponse);

    render(<ForecastImpactDashboard isOpen={true} onClose={() => {}} activeSectorKey="chennai" />);

    await waitFor(() => {
      expect(screen.getByText('CHENNAI')).toBeDefined();
    });

    // Switch to national mode
    const nationalBtn = screen.getByRole('button', { name: /National/i });
    fireEvent.click(nationalBtn);

    await waitFor(() => {
      expect(screen.getByText('INDICATIVE COVERAGE')).toBeDefined();
      expect(screen.getByText(/Synoptic Macro-Mesh \(Indicative Only; Non-Municipal\)/i)).toBeDefined();
      expect(screen.queryByText('SUFFICIENT MESOSCALE COVERAGE')).toBeNull();
    });
  });

  it('renders single-node localized density warning banner for 1-node districts', async () => {
    render(<ForecastImpactDashboard isOpen={true} onClose={() => {}} activeSectorKey="chennai" />);

    await waitFor(() => {
      expect(screen.getByText('CHENNAI')).toBeDefined();
    });

    // Single-node localized banner
    expect(screen.getByText(/Localized Point Sampling:/i)).toBeDefined();
    expect(screen.getByText(/District estimate relies on a single interior NWP node/i)).toBeDefined();
  });

  it('renders null 72h accumulation as "Unavailable*" with footnote and never coerces to 0', async () => {
    render(<ForecastImpactDashboard isOpen={true} onClose={() => {}} activeSectorKey="chennai" />);

    await waitFor(() => {
      expect(screen.getByText('CHENNAI')).toBeDefined();
    });

    // Expand the CHENNAI card to see prospective accumulations
    const chennaiCard = screen.getByText('CHENNAI');
    fireEvent.click(chennaiCard);

    await waitFor(() => {
      expect(screen.getByText('Unavailable*')).toBeDefined();
    });
    expect(screen.getByText(/\*Upstream NWP dataset provides 71 future hourly intervals/i)).toBeDefined();
  });

  it('renders separate IMD official bulletin alert banner alongside model-derived rainfall', async () => {
    render(<ForecastImpactDashboard isOpen={true} onClose={() => {}} activeSectorKey="chennai" />);

    await waitFor(() => {
      expect(screen.getByText('CHENNAI')).toBeDefined();
    });

    // Expand card to view alert details
    fireEvent.click(screen.getByText('CHENNAI'));

    await waitFor(() => {
      expect(screen.getByText(/OFFICIAL IMD NOWCAST BULLETIN \(SEPARATE AUTHORITY\):/i)).toBeDefined();
      expect(screen.getByText(/Heavy rainfall warning for coastal districts of Tamil Nadu/i)).toBeDefined();
    });
  });

  it('displays located emergency facilities with explicit non-inundation disclosure', async () => {
    render(<ForecastImpactDashboard isOpen={true} onClose={() => {}} activeSectorKey="chennai" />);

    await waitFor(() => {
      expect(screen.getByText('CHENNAI')).toBeDefined();
    });

    // Expand card
    fireEvent.click(screen.getByText('CHENNAI'));

    await waitFor(() => {
      expect(screen.getByText(/14 Facilities Located/i)).toBeDefined();
      expect(screen.getAllByText(/Geographic co-location in district does NOT imply physical inundation, hydraulic flooding, or structural damage/i).length).toBeGreaterThan(0);
    });
  });

  it('filters districts by search text input', async () => {
    render(<ForecastImpactDashboard isOpen={true} onClose={() => {}} activeSectorKey="chennai" />);

    await waitFor(() => {
      expect(screen.getByText('CHENNAI')).toBeDefined();
      expect(screen.getByText('KANCHIPURAM')).toBeDefined();
    });

    const searchInput = screen.getByPlaceholderText(/Filter by district or state name.../i);
    fireEvent.change(searchInput, { target: { value: 'KANCHI' } });

    expect(screen.queryByText('CHENNAI')).toBeNull();
    expect(screen.getByText('KANCHIPURAM')).toBeDefined();
  });

  it('filters districts by IMD category button', async () => {
    render(<ForecastImpactDashboard isOpen={true} onClose={() => {}} activeSectorKey="chennai" />);

    await waitFor(() => {
      expect(screen.getByText('CHENNAI')).toBeDefined();
      expect(screen.getByText('KANCHIPURAM')).toBeDefined();
    });

    // Click on 'V. HEAVY' category filter button
    const veryHeavyBtn = screen.getByRole('button', { name: 'V. HEAVY' });
    fireEvent.click(veryHeavyBtn);

    expect(screen.queryByText('CHENNAI')).toBeNull();
    expect(screen.getByText('KANCHIPURAM')).toBeDefined();
  });

  it('allows switching operational sector and national mode', async () => {
    const handleSelectSector = vi.fn();
    render(
      <ForecastImpactDashboard
        isOpen={true}
        onClose={() => {}}
        activeSectorKey="chennai"
        onSelectSector={handleSelectSector}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('CHENNAI')).toBeDefined();
    });

    // Switch to Mumbai
    const mumbaiBtn = screen.getByRole('button', { name: /Mumbai/i });
    fireEvent.click(mumbaiBtn);

    expect(handleSelectSector).toHaveBeenCalledWith('mumbai');

    // Switch to National mode
    const nationalBtn = screen.getByRole('button', { name: /National/i });
    fireEvent.click(nationalBtn);

    await waitFor(() => {
      expect(impactService.getForecastImpact).toHaveBeenCalledWith('national', undefined, false);
    });
  });

  it('renders failover and stale banners when metadata flags are active', async () => {
    vi.spyOn(impactService, 'getForecastImpact').mockResolvedValueOnce({
      ...mockResponse,
      metadata: {
        ...mockResponse.metadata,
        isFallback: true,
        isStale: true,
      },
    });

    render(<ForecastImpactDashboard isOpen={true} onClose={() => {}} activeSectorKey="chennai" />);

    await waitFor(() => {
      expect(screen.getByText(/FAILOVER ACTIVE:/i)).toBeDefined();
      expect(screen.getByText(/STALE CACHE ACTIVE:/i)).toBeDefined();
    });
  });

  describe('Lifecycle Stability & HTTP 429 Recovery (Phase 3D-3)', () => {
    it('does not trigger repeated fetch requests when parent re-renders with fresh callback reference', async () => {
      const getImpactSpy = vi.spyOn(impactService, 'getForecastImpact').mockResolvedValue(mockResponse);

      let callbackCallCount = 0;
      const { rerender } = render(
        <ForecastImpactDashboard
          isOpen={true}
          onClose={() => {}}
          activeSectorKey="chennai"
          onDataLoaded={() => {
            callbackCallCount++;
          }}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('CHENNAI')).toBeDefined();
      });

      expect(getImpactSpy).toHaveBeenCalledTimes(1);

      // Re-render multiple times with new inline callback references (simulating LiveMapPage re-renders)
      rerender(
        <ForecastImpactDashboard
          isOpen={true}
          onClose={() => {}}
          activeSectorKey="chennai"
          onDataLoaded={() => {
            callbackCallCount++;
          }}
        />
      );

      rerender(
        <ForecastImpactDashboard
          isOpen={true}
          onClose={() => {}}
          activeSectorKey="chennai"
          onDataLoaded={() => {
            callbackCallCount++;
          }}
        />
      );

      // Must remain exactly 1 network call, breaking the infinite cascade
      expect(getImpactSpy).toHaveBeenCalledTimes(1);
    });

    it('guarantees onDataLoadedRef invokes the latest parent callback after parent re-renders', async () => {
      let resolvePromise: (val: any) => void = () => {};
      const delayedPromise = new Promise((resolve) => {
        resolvePromise = resolve;
      });

      vi.spyOn(impactService, 'getForecastImpact').mockImplementation(() => delayedPromise as any);

      const callbackInitial = vi.fn();
      const callbackUpdated = vi.fn();

      const { rerender } = render(
        <ForecastImpactDashboard
          isOpen={true}
          onClose={() => {}}
          activeSectorKey="chennai"
          onDataLoaded={callbackInitial}
        />
      );

      // Parent re-renders before promise resolves, passing updated callback
      rerender(
        <ForecastImpactDashboard
          isOpen={true}
          onClose={() => {}}
          activeSectorKey="chennai"
          onDataLoaded={callbackUpdated}
        />
      );

      // Now resolve the delayed promise
      resolvePromise(mockResponse);

      await waitFor(() => {
        expect(callbackUpdated).toHaveBeenCalledWith(mockResponse);
      });

      // Initial stale callback must NOT have been called
      expect(callbackInitial).not.toHaveBeenCalled();
    });

    it('displays HTTP 429 rate limit error accurately and recovers cleanly via retry button', async () => {
      const getImpactSpy = vi
        .spyOn(impactService, 'getForecastImpact')
        .mockRejectedValueOnce(new Error('API rate limit exceeded. Please wait a moment before sending more requests.'))
        .mockResolvedValueOnce(mockResponse);

      render(<ForecastImpactDashboard isOpen={true} onClose={() => {}} activeSectorKey="chennai" />);

      // Verify 429 error banner is displayed
      await waitFor(() => {
        expect(screen.getByText(/API rate limit exceeded/i)).toBeDefined();
      });

      // Verify retry button is available
      const retryBtn = screen.getByRole('button', { name: /Retry Request/i });
      expect(retryBtn).toBeDefined();

      // Click retry
      fireEvent.click(retryBtn);

      // Verify clean recovery and error banner removal
      await waitFor(() => {
        expect(screen.getByText('CHENNAI')).toBeDefined();
      });

      expect(screen.queryByText(/API rate limit exceeded/i)).toBeNull();
      expect(getImpactSpy).toHaveBeenCalledTimes(2);
    });

    it('triggers cache-bypass refresh when Refresh Data button is clicked', async () => {
      const getImpactSpy = vi.spyOn(impactService, 'getForecastImpact').mockResolvedValue(mockResponse);

      render(<ForecastImpactDashboard isOpen={true} onClose={() => {}} activeSectorKey="chennai" />);

      await waitFor(() => {
        expect(screen.getByText('CHENNAI')).toBeDefined();
      });

      expect(getImpactSpy).toHaveBeenCalledWith('sector', 'chennai', false);

      const refreshBtn = screen.getByTitle(/Refresh Forecast Impact/i);
      fireEvent.click(refreshBtn);

      await waitFor(() => {
        expect(getImpactSpy).toHaveBeenCalledWith('sector', 'chennai', true);
      });
    });

    it('unmounts cleanly without throwing or triggering memory leaks', async () => {
      vi.spyOn(impactService, 'getForecastImpact').mockResolvedValue(mockResponse);

      const { unmount } = render(
        <ForecastImpactDashboard isOpen={true} onClose={() => {}} activeSectorKey="chennai" />
      );

      await waitFor(() => {
        expect(screen.getByText('CHENNAI')).toBeDefined();
      });

      expect(() => unmount()).not.toThrow();
    });
  });

  /* -------------------------------------------------------------------------- */
  /* PHASE 3E-2: DECISION SUPPORT FRONTEND INTELLIGENCE SUITE                    */
  /* -------------------------------------------------------------------------- */
  describe('Phase 3E-2: Decision Support Frontend Intelligence Suite', () => {
    function createDecisionDistrict(
      district: string,
      state: string,
      opts: {
        priorityTier: impactService.RainfallPriorityTier;
        imd24hCategory: impactService.ImdRainfallCategory;
        peakHourlyCategory: impactService.ImdHourlyRateCategory;
        accum24hMm: number | null;
        peakHourlyRateMmH: number | null;
        windSeverity: impactService.WindSeverityCategory;
        maxWindGustKmh: number | null;
        peakGustTimeUtc?: string | null;
        overallStatus?: impactService.OverallDataStatus;
        missingVariables?: string[];
        trajectoryPattern?: impactService.First24hTrajectory;
        drivers?: Partial<Record<impactService.ContributingDriverKey, Partial<impactService.ContributingDriverState>>>;
      }
    ): impactService.DistrictForecastImpact {
      const driverKeys: impactService.ContributingDriverKey[] = [
        'CONVECTIVE_BURST',
        'PROLONGED_INTENSITY',
        'GALE_GUST_COINCIDENCE',
        'RAPID_BAROMETRIC_DROP',
        'IMMINENT_ONSET',
      ];

      const contributingDrivers: impactService.ContributingDriverState[] = driverKeys.map((key) => {
        const override = opts.drivers?.[key];
        return {
          key,
          status: override?.status || 'NOT_TRIGGERED',
          evidence: override?.evidence || (override?.status === 'TRIGGERED' ? {
            observedValue: 22.0,
            threshold: 15.0,
            units: 'mm/h',
            timestampUtc: '2026-11-13T14:00:00.000Z',
          } : undefined),
          missingDataReason: override?.missingDataReason,
          provenance: 'PROPOSED_HEURISTIC',
        };
      });

      const extendedBlocks: impactService.ExtendedForecastBlock[] = Array.from({ length: 12 }, (_, i) => {
        const idx = i + 1;
        const start = (idx - 1) * 6 + 1;
        const dur = idx === 12 ? 5 : 6;
        const end = start + dur - 1;
        return {
          blockIndex: idx,
          startHour: start,
          endHour: end,
          durationHours: dur,
          isIncomplete: false,
          accumMm: idx === 1 ? (opts.accum24hMm ? +(opts.accum24hMm * 0.4).toFixed(1) : 0) : 10.0,
          meanRateMmH: +(10 / dur).toFixed(2),
        };
      });

      const decisionSupport: impactService.DistrictDecisionSupport = {
        availability: {
          overallStatus: opts.overallStatus || 'COMPLETE',
          isPrecipitationAvailable: opts.accum24hMm !== null,
          isWindAvailable: opts.maxWindGustKmh !== null,
          isPressureAvailable: true,
          missingVariables: opts.missingVariables || [],
        },
        rainfall: {
          status: opts.accum24hMm !== null ? 'AVAILABLE' : 'DATA_INSUFFICIENT',
          priorityTier: opts.priorityTier,
          imd24hCategory: opts.imd24hCategory,
          accum24hMm: opts.accum24hMm,
          peakHourlyRateMmH: opts.peakHourlyRateMmH,
          peakHourlyCategory: opts.peakHourlyCategory,
          peakHourlyTimeUtc: opts.peakHourlyRateMmH ? '2026-11-13T14:00:00.000Z' : null,
          thresholdDefinition: 'JATAYU Implementation of IMD-Aligned 24h Rainfall Thresholds',
          priorityDefinition: 'JATAYU Internal Decision-Support Heuristic',
          hourlyIntensityBenchmark: 'JATAYU Hourly Intensity Benchmark (Informed by IMD Guidance)',
        },
        wind: {
          status: opts.maxWindGustKmh !== null ? 'AVAILABLE' : 'UNAVAILABLE',
          severityCategory: opts.windSeverity,
          maxWindGustKmh: opts.maxWindGustKmh,
          peakGustTimeUtc: opts.peakGustTimeUtc !== undefined ? opts.peakGustTimeUtc : '2026-11-13T15:00:00.000Z',
          provenance: 'PROPOSED_HEURISTIC_WIND_SCALE',
        },
        temporalMilestones: {
          first24hTrajectory: opts.trajectoryPattern || 'INTENSIFYING',
          w1Mm: 5.0,
          w2Mm: 12.0,
          w3Mm: 25.0,
          w4Mm: 35.0,
          onsetHourUtc: '2026-11-13T02:00:00.000Z',
          peakHourUtc: '2026-11-13T14:00:00.000Z',
          cessationHourUtc: '2026-11-13T22:00:00.000Z',
          elevatedHoursTotal: 4,
          longestElevatedRunHours: 3,
        },
        extendedBlocks,
        contributingDrivers,
      };

      return {
        district,
        state,
        censusCode: '100',
        coverage: {
          status: 'SUFFICIENT_MESOSCALE',
          spatialDensity: 'MULTI_NODE_REPRESENTATIVE',
          nodeCount: 3,
          method: 'POLYGON_INTERIOR',
        },
        metrics: {
          futureAccum6hMm: 15.0,
          futureAccum12hMm: 35.0,
          futureAccum24hMm: opts.accum24hMm,
          futureAccum48hMm: opts.accum24hMm ? opts.accum24hMm * 1.3 : null,
          futureAccum72hMm: null,
          accum72hQualityReason: 'NWP dataset spans 71 future hourly steps.',
          peakHourlyRateMmH: opts.peakHourlyRateMmH,
          peakHourlyTimeUtc: '2026-11-13T14:00:00.000Z',
          peakHourlyRateCategory: opts.peakHourlyCategory,
          maxWindGustKmh: opts.maxWindGustKmh,
        },
        dataQuality: {
          isComplete: opts.overallStatus !== 'UNAVAILABLE',
          totalExpectedHours: 71,
          totalAvailableHours: opts.overallStatus === 'UNAVAILABLE' ? 0 : 71,
          continuityValid: true,
        },
        classification: {
          imdRainfallCategory: opts.imd24hCategory,
          thresholdDefinition: 'JATAYU Implementation of IMD-Aligned 24h Rainfall Thresholds',
        },
        localExposure: {
          verifiedEmergencyFacilitiesCount: 5,
          facilityTypes: { hospitals: 2, shelters: 2, fireStations: 1, other: 0 },
          exposureNotice: 'Co-location does not imply hydraulic inundation.',
        },
        decisionSupport,
      };
    }

    it('renders all five rainfall priority tiers with distinct visual badges and explicit provenance definitions', async () => {
      const districts: impactService.DistrictForecastImpact[] = [
        createDecisionDistrict('DISTRICT_T1', 'TAMIL NADU', {
          priorityTier: 'TIER_1_CRITICAL',
          imd24hCategory: 'EXTREMELY_HEAVY_RAIN',
          peakHourlyCategory: 'VERY_HEAVY',
          accum24hMm: 215.0,
          peakHourlyRateMmH: 35.0,
          windSeverity: 'EXTREME_GALE_STORM',
          maxWindGustKmh: 95.0,
        }),
        createDecisionDistrict('DISTRICT_T2', 'TAMIL NADU', {
          priorityTier: 'TIER_2_ELEVATED',
          imd24hCategory: 'VERY_HEAVY_RAIN',
          peakHourlyCategory: 'HEAVY',
          accum24hMm: 130.0,
          peakHourlyRateMmH: 18.0,
          windSeverity: 'GALE_FORCE',
          maxWindGustKmh: 68.0,
        }),
        createDecisionDistrict('DISTRICT_T3', 'TAMIL NADU', {
          priorityTier: 'TIER_3_WATCH',
          imd24hCategory: 'HEAVY_RAIN',
          peakHourlyCategory: 'MODERATE',
          accum24hMm: 75.0,
          peakHourlyRateMmH: 12.0,
          windSeverity: 'ROUTINE',
          maxWindGustKmh: 45.0,
        }),
        createDecisionDistrict('DISTRICT_T4', 'TAMIL NADU', {
          priorityTier: 'TIER_4_ADVISORY',
          imd24hCategory: 'MODERATE_RAIN',
          peakHourlyCategory: 'LIGHT',
          accum24hMm: 35.0,
          peakHourlyRateMmH: 4.5,
          windSeverity: 'ROUTINE',
          maxWindGustKmh: 35.0,
        }),
        createDecisionDistrict('DISTRICT_T5', 'TAMIL NADU', {
          priorityTier: 'TIER_5_ROUTINE',
          imd24hCategory: 'LIGHT_RAIN',
          peakHourlyCategory: 'LIGHT',
          accum24hMm: 6.0,
          peakHourlyRateMmH: 1.5,
          windSeverity: 'ROUTINE',
          maxWindGustKmh: 20.0,
        }),
      ];

      const customResponse: impactService.ForecastImpactResponse = {
        ...mockResponse,
        summary: {
          ...mockResponse.summary,
          districtsEvaluated: 5,
        },
        districts,
      };

      vi.spyOn(impactService, 'getForecastImpact').mockResolvedValue(customResponse);

      render(<ForecastImpactDashboard isOpen={true} onClose={() => {}} activeSectorKey="chennai" />);

      await waitFor(() => {
        expect(screen.getByText('DISTRICT_T1')).toBeDefined();
        expect(screen.getByText('DISTRICT_T2')).toBeDefined();
        expect(screen.getByText('DISTRICT_T3')).toBeDefined();
        expect(screen.getByText('DISTRICT_T4')).toBeDefined();
        expect(screen.getByText('DISTRICT_T5')).toBeDefined();
      });

      // Expand DISTRICT_T1 to inspect intelligence cards and provenance
      fireEvent.click(screen.getByText('DISTRICT_T1'));

      await waitFor(() => {
        expect(screen.getByText(/JATAYU Internal Decision-Support Heuristic/i)).toBeDefined();
        expect(screen.getAllByText(/JATAYU Implementation of IMD-Aligned 24h Rainfall Thresholds/i).length).toBeGreaterThanOrEqual(1);
        expect(screen.getByText(/JATAYU Hourly Intensity Benchmark \(Informed by IMD Guidance\)/i)).toBeDefined();
      });

      // Verify separate accumulation and hourly metrics
      expect(screen.getAllByText('215.0 mm').length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText('35.0 mm/h')).toBeDefined();
    });

    it('displays independent wind severity, maximum gust speed, and UTC timestamp without coupling to rainfall tier', async () => {
      // District has low rainfall (Tier 5 Routine) but severe wind (Gale Force)
      const galeDistrict = createDecisionDistrict('GALE_DISTRICT', 'TAMIL NADU', {
        priorityTier: 'TIER_5_ROUTINE',
        imd24hCategory: 'LIGHT_RAIN',
        peakHourlyCategory: 'LIGHT',
        accum24hMm: 4.0,
        peakHourlyRateMmH: 1.0,
        windSeverity: 'GALE_FORCE',
        maxWindGustKmh: 75.6,
        peakGustTimeUtc: '2026-11-13T17:30:00.000Z',
      });

      const response: impactService.ForecastImpactResponse = {
        ...mockResponse,
        summary: { ...mockResponse.summary, districtsEvaluated: 1 },
        districts: [galeDistrict],
      };

      vi.spyOn(impactService, 'getForecastImpact').mockResolvedValue(response);

      render(<ForecastImpactDashboard isOpen={true} onClose={() => {}} activeSectorKey="chennai" />);

      await waitFor(() => {
        expect(screen.getByText('GALE_DISTRICT')).toBeDefined();
      });

      // Expand to view Wind Intelligence Card
      fireEvent.click(screen.getByText('GALE_DISTRICT'));

      await waitFor(() => {
        expect(screen.getAllByText('75.6 km/h').length).toBeGreaterThanOrEqual(1);
        expect(screen.getByText('PROPOSED_HEURISTIC_WIND_SCALE')).toBeDefined();
        expect(screen.getByText(/Wind severity is computed independently from rainfall priority tier/i)).toBeDefined();
        expect(screen.getByText('2026-11-13 17:30 UTC')).toBeDefined();
      });
    });

    it('renders all three contributing driver states (TRIGGERED, NOT_TRIGGERED, UNAVAILABLE) with observed evidence and missing data reason', async () => {
      const driverDistrict = createDecisionDistrict('DRIVER_DISTRICT', 'TAMIL NADU', {
        priorityTier: 'TIER_2_ELEVATED',
        imd24hCategory: 'VERY_HEAVY_RAIN',
        peakHourlyCategory: 'HEAVY',
        accum24hMm: 120.0,
        peakHourlyRateMmH: 22.0,
        windSeverity: 'ROUTINE',
        maxWindGustKmh: 40.0,
        drivers: {
          CONVECTIVE_BURST: {
            status: 'TRIGGERED',
            evidence: {
              observedValue: 22.0,
              threshold: 15.0,
              units: 'mm/h',
            },
          },
          PROLONGED_INTENSITY: {
            status: 'NOT_TRIGGERED',
          },
          RAPID_BAROMETRIC_DROP: {
            status: 'UNAVAILABLE',
            missingDataReason: 'Surface pressure series unavailable from local grid mesh',
          },
        },
      });

      const response: impactService.ForecastImpactResponse = {
        ...mockResponse,
        summary: { ...mockResponse.summary, districtsEvaluated: 1 },
        districts: [driverDistrict],
      };

      vi.spyOn(impactService, 'getForecastImpact').mockResolvedValue(response);

      render(<ForecastImpactDashboard isOpen={true} onClose={() => {}} activeSectorKey="chennai" />);

      await waitFor(() => {
        expect(screen.getByText('DRIVER_DISTRICT')).toBeDefined();
      });

      fireEvent.click(screen.getByText('DRIVER_DISTRICT'));

      await waitFor(() => {
        // Triggered driver evidence
        expect(screen.getByText('TRIGGERED')).toBeDefined();
        expect(screen.getByText(/22 mm\/h \(Threshold: 15 mm\/h\)/i)).toBeDefined();

        // Not triggered driver
        expect(screen.getAllByText('NOT_TRIGGERED').length).toBeGreaterThanOrEqual(1);

        // Unavailable driver missing reason
        expect(screen.getByText('UNAVAILABLE')).toBeDefined();
        expect(screen.getByText('Surface pressure series unavailable from local grid mesh')).toBeDefined();
      });
    });

    it('renders overall meteorological availability and lists missing variables for partial data', async () => {
      const partialDistrict = createDecisionDistrict('PARTIAL_DATA_DISTRICT', 'TAMIL NADU', {
        priorityTier: 'TIER_3_WATCH',
        imd24hCategory: 'HEAVY_RAIN',
        peakHourlyCategory: 'MODERATE',
        accum24hMm: 70.0,
        peakHourlyRateMmH: 10.0,
        windSeverity: 'UNAVAILABLE',
        maxWindGustKmh: null,
        overallStatus: 'PARTIAL',
        missingVariables: ['10m Wind Gusts', 'Surface Barometric Pressure'],
      });

      const response: impactService.ForecastImpactResponse = {
        ...mockResponse,
        summary: { ...mockResponse.summary, districtsEvaluated: 1 },
        districts: [partialDistrict],
      };

      vi.spyOn(impactService, 'getForecastImpact').mockResolvedValue(response);

      render(<ForecastImpactDashboard isOpen={true} onClose={() => {}} activeSectorKey="chennai" />);

      await waitFor(() => {
        expect(screen.getByText('PARTIAL_DATA_DISTRICT')).toBeDefined();
        expect(screen.getAllByText('PARTIAL').length).toBeGreaterThanOrEqual(1);
      });

      fireEvent.click(screen.getByText('PARTIAL_DATA_DISTRICT'));

      await waitFor(() => {
        expect(screen.getByText(/Missing Variables:/i)).toBeDefined();
        expect(screen.getByText(/10m Wind Gusts, Surface Barometric Pressure/i)).toBeDefined();
      });
    });

    it('renders First-24-hour rainfall trajectory and extended forecast blocks with Block 12 5h duration note', async () => {
      const trajectoryDistrict = createDecisionDistrict('TRAJECTORY_DISTRICT', 'TAMIL NADU', {
        priorityTier: 'TIER_2_ELEVATED',
        imd24hCategory: 'VERY_HEAVY_RAIN',
        peakHourlyCategory: 'HEAVY',
        accum24hMm: 140.0,
        peakHourlyRateMmH: 25.0,
        windSeverity: 'NEAR_GALE',
        maxWindGustKmh: 55.0,
        trajectoryPattern: 'INTENSIFYING',
      });

      const response: impactService.ForecastImpactResponse = {
        ...mockResponse,
        summary: { ...mockResponse.summary, districtsEvaluated: 1 },
        districts: [trajectoryDistrict],
      };

      vi.spyOn(impactService, 'getForecastImpact').mockResolvedValue(response);

      render(<ForecastImpactDashboard isOpen={true} onClose={() => {}} activeSectorKey="chennai" />);

      await waitFor(() => {
        expect(screen.getByText('TRAJECTORY_DISTRICT')).toBeDefined();
      });

      fireEvent.click(screen.getByText('TRAJECTORY_DISTRICT'));

      await waitFor(() => {
        // Trajectory pattern
        expect(screen.getAllByText('Intensifying').length).toBeGreaterThanOrEqual(1);

        // Extended blocks: verify Block 12 duration note
        expect(screen.getByText(/Block 12 is strictly 5h \(T\+67\.\.71\)/i)).toBeDefined();
        expect(screen.getByText('W12 (5h)')).toBeDefined();
      });
    });

    it('allows filtering districts by rainfall priority tier pills and resetting filter', async () => {
      const districts: impactService.DistrictForecastImpact[] = [
        createDecisionDistrict('CHENNAI_T1', 'TAMIL NADU', {
          priorityTier: 'TIER_1_CRITICAL',
          imd24hCategory: 'EXTREMELY_HEAVY_RAIN',
          peakHourlyCategory: 'VERY_HEAVY',
          accum24hMm: 220.0,
          peakHourlyRateMmH: 40.0,
          windSeverity: 'GALE_FORCE',
          maxWindGustKmh: 75.0,
        }),
        createDecisionDistrict('TIRUVALLUR_T5', 'TAMIL NADU', {
          priorityTier: 'TIER_5_ROUTINE',
          imd24hCategory: 'LIGHT_RAIN',
          peakHourlyCategory: 'LIGHT',
          accum24hMm: 3.0,
          peakHourlyRateMmH: 1.0,
          windSeverity: 'ROUTINE',
          maxWindGustKmh: 20.0,
        }),
      ];

      const response: impactService.ForecastImpactResponse = {
        ...mockResponse,
        summary: { ...mockResponse.summary, districtsEvaluated: 2 },
        districts,
      };

      vi.spyOn(impactService, 'getForecastImpact').mockResolvedValue(response);

      render(<ForecastImpactDashboard isOpen={true} onClose={() => {}} activeSectorKey="chennai" />);

      await waitFor(() => {
        expect(screen.getByText('CHENNAI_T1')).toBeDefined();
        expect(screen.getByText('TIRUVALLUR_T5')).toBeDefined();
      });

      // Filter by Tier 1 Critical
      const t1Pill = screen.getByRole('button', { name: /Tier 1 Critical/i });
      fireEvent.click(t1Pill);

      await waitFor(() => {
        expect(screen.getByText('CHENNAI_T1')).toBeDefined();
        expect(screen.queryByText('TIRUVALLUR_T5')).toBeNull();
      });

      // Reset filter
      const allPill = screen.getByRole('button', { name: /All Tiers/i });
      fireEvent.click(allPill);

      await waitFor(() => {
        expect(screen.getByText('CHENNAI_T1')).toBeDefined();
        expect(screen.getByText('TIRUVALLUR_T5')).toBeDefined();
      });
    });

    it('interactively expands district details and triggers onSelectDistrict when Center Map button is clicked', async () => {
      const handleSelectDistrict = vi.fn();
      const testDistrict = createDecisionDistrict('VELLORE', 'TAMIL NADU', {
        priorityTier: 'TIER_3_WATCH',
        imd24hCategory: 'HEAVY_RAIN',
        peakHourlyCategory: 'MODERATE',
        accum24hMm: 80.0,
        peakHourlyRateMmH: 12.0,
        windSeverity: 'ROUTINE',
        maxWindGustKmh: 42.0,
      });

      const response: impactService.ForecastImpactResponse = {
        ...mockResponse,
        summary: { ...mockResponse.summary, districtsEvaluated: 1 },
        districts: [testDistrict],
      };

      vi.spyOn(impactService, 'getForecastImpact').mockResolvedValue(response);

      render(
        <ForecastImpactDashboard
          isOpen={true}
          onClose={() => {}}
          activeSectorKey="chennai"
          onSelectDistrict={handleSelectDistrict}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('VELLORE')).toBeDefined();
      });

      // Click district to expand
      fireEvent.click(screen.getByText('VELLORE'));

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Center Map on VELLORE/i })).toBeDefined();
      });

      // Click Center Map button
      const centerBtn = screen.getByRole('button', { name: /Center Map on VELLORE/i });
      fireEvent.click(centerBtn);

      expect(handleSelectDistrict).toHaveBeenCalledWith('VELLORE', 'TAMIL NADU');
    });

    it('displays national synoptic coarse-grid banner and indicative labeling in national mode', async () => {
      const nationalResponse: impactService.ForecastImpactResponse = {
        ...mockResponse,
        metadata: {
          ...mockResponse.metadata,
          mode: 'national',
          activeSector: undefined,
        },
        districts: [
          createDecisionDistrict('NATION_WIDE_DISTRICT', 'MAHARASHTRA', {
            priorityTier: 'TIER_4_ADVISORY',
            imd24hCategory: 'MODERATE_RAIN',
            peakHourlyCategory: 'MODERATE',
            accum24hMm: 45.0,
            peakHourlyRateMmH: 6.0,
            windSeverity: 'ROUTINE',
            maxWindGustKmh: 30.0,
          }),
        ],
      };

      vi.spyOn(impactService, 'getForecastImpact').mockResolvedValue(nationalResponse);

      render(<ForecastImpactDashboard isOpen={true} onClose={() => {}} activeSectorKey="mumbai" />);

      // Switch to National mode
      const nationalBtn = screen.getByRole('button', { name: /National/i });
      fireEvent.click(nationalBtn);

      await waitFor(() => {
        expect(
          screen.getByText(/NATIONAL SYNOPTIC COARSE-GRID \(INDICATIVE ONLY; NON-MUNICIPAL\)/i)
        ).toBeDefined();
        expect(
          screen.getByText(/coarse synoptic prioritization across Indian districts/i)
        ).toBeDefined();
      });
    });
  });
});
