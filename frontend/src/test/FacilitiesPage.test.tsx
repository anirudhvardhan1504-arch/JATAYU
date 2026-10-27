import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { FacilitiesPage } from '../pages/FacilitiesPage';
import { LanguageProvider } from '../context/LanguageContext';
import * as routeService from '../services/route';
import { EmergencyFacility } from '../types';

const mockFacilityList: EmergencyFacility[] = [
  {
    id: 'fac-1',
    name: 'Government Multi Super Speciality Hospital',
    category: 'HOSPITAL',
    location: { latitude: 13.0732, longitude: 80.2609 },
    address: 'Omandurar Government Estate, Chennai',
    phone: '044-25666000',
    distanceKm: 1.5,
    currentAvailability: 'UNKNOWN',
    verificationStatus: 'OFFICIALLY_VERIFIED',
    source: 'OSM Overpass / Verified Registry',
  },
  {
    id: 'fac-2',
    name: 'Saidapet Community Evacuation Relief Centre',
    category: 'SHELTER',
    location: { latitude: 13.0210, longitude: 80.2230 },
    address: 'Saidapet West, Chennai',
    distanceKm: 6.8,
    currentAvailability: 'UNKNOWN',
    verificationStatus: 'OFFICIALLY_VERIFIED',
    source: 'OSM Overpass / Verified Registry',
  },
  {
    id: 'fac-3',
    name: 'Greater Chennai Corporation Disaster Control Room',
    category: 'EMERGENCY_OPS',
    location: { latitude: 13.0827, longitude: 80.2707 },
    address: 'Ripon Building, Chennai',
    phone: '1913',
    distanceKm: 0.2,
    currentAvailability: 'UNKNOWN',
    verificationStatus: 'OFFICIALLY_VERIFIED',
    source: 'OSM Overpass / Verified Registry',
  },
];

const mockFacilitiesResponse = {
  facilities: mockFacilityList,
  count: 3,
  sourceAttribution: 'Vetted OpenStreetMap & Official Registry',
  disclaimer: 'Operational availability is unverified.',
};

describe('JATAYU Phase 3A — FacilitiesPage Dedicated Public Directory', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('fetches and renders nearby emergency facilities with distance and category badges', async () => {
    vi.spyOn(routeService, 'getEmergencyFacilities').mockResolvedValue(mockFacilitiesResponse as any);

    render(
      <LanguageProvider defaultLanguage="en">
        <FacilitiesPage
          location={{ name: 'Chennai Central', lat: 13.0827, lon: 80.2707 }}
          onPlanRouteToFacility={vi.fn()}
        />
      </LanguageProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('Government Multi Super Speciality Hospital')).toBeInTheDocument();
      expect(screen.getByText('Saidapet Community Evacuation Relief Centre')).toBeInTheDocument();
      expect(screen.getByText('Greater Chennai Corporation Disaster Control Room')).toBeInTheDocument();
    });

    // Check distance rendering
    expect(screen.getByText('0.2 km')).toBeInTheDocument();
    expect(screen.getByText('1.5 km')).toBeInTheDocument();
    expect(screen.getByText('6.8 km')).toBeInTheDocument();
  });

  it('renders mandatory unverified availability disclaimer on every facility', async () => {
    vi.spyOn(routeService, 'getEmergencyFacilities').mockResolvedValue(mockFacilitiesResponse as any);

    render(
      <LanguageProvider defaultLanguage="en">
        <FacilitiesPage
          location={{ name: 'Chennai Central', lat: 13.0827, lon: 80.2707 }}
          onPlanRouteToFacility={vi.fn()}
        />
      </LanguageProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('Government Multi Super Speciality Hospital')).toBeInTheDocument();
    });

    // Mandatory disclaimer banner
    expect(
      screen.getByText(/Operational availability and vacancy are strictly UNKNOWN/i)
    ).toBeInTheDocument();

    // Check individual unknown availability badges
    const unknownBadges = screen.getAllByText(/VACANCY: UNKNOWN/i);
    expect(unknownBadges.length).toBe(3);
  });

  it('filters facilities by category when clicking category tabs', async () => {
    vi.spyOn(routeService, 'getEmergencyFacilities').mockResolvedValue(mockFacilitiesResponse as any);

    render(
      <LanguageProvider defaultLanguage="en">
        <FacilitiesPage
          location={{ name: 'Chennai Central', lat: 13.0827, lon: 80.2707 }}
          onPlanRouteToFacility={vi.fn()}
        />
      </LanguageProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('Government Multi Super Speciality Hospital')).toBeInTheDocument();
    });

    // Filter to Hospitals only
    fireEvent.click(screen.getByRole('button', { name: /^Hospitals & Trauma/i }));
    expect(screen.getByText('Government Multi Super Speciality Hospital')).toBeInTheDocument();
    expect(screen.queryByText('Saidapet Community Evacuation Relief Centre')).toBeNull();

    // Filter to Relief Shelters only
    fireEvent.click(screen.getByRole('button', { name: /^Relief Shelters/i }));
    expect(screen.queryByText('Government Multi Super Speciality Hospital')).toBeNull();
    expect(screen.getByText('Saidapet Community Evacuation Relief Centre')).toBeInTheDocument();
  });

  it('filters facilities by search query term', async () => {
    vi.spyOn(routeService, 'getEmergencyFacilities').mockResolvedValue(mockFacilitiesResponse as any);

    render(
      <LanguageProvider defaultLanguage="en">
        <FacilitiesPage
          location={{ name: 'Chennai Central', lat: 13.0827, lon: 80.2707 }}
          onPlanRouteToFacility={vi.fn()}
        />
      </LanguageProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('Government Multi Super Speciality Hospital')).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText(/Search facility name or address/i);
    fireEvent.change(searchInput, { target: { value: 'Ripon' } });

    expect(screen.getByText('Greater Chennai Corporation Disaster Control Room')).toBeInTheDocument();
    expect(screen.queryByText('Government Multi Super Speciality Hospital')).toBeNull();
  });
});
