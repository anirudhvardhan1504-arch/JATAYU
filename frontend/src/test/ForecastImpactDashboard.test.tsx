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
      expect(screen.getByText('3')).toBeDefined(); // Evaluated
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
});
