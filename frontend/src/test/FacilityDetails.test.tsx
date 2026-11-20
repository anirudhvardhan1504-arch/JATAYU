import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { FacilityCard } from '../components/route/FacilityCard';
import { FacilitiesPage } from '../pages/FacilitiesPage';
import { LanguageProvider } from '../context/LanguageContext';
import { EmergencyFacility, EmergencyFacilitiesResponse } from '../types';
import * as service from '../services/route';

const facility: EmergencyFacility = {
  id: 'hyd-apollo', name: 'Hyderabad medical directory record', category: 'HOSPITAL',
  location: { latitude: 17.39948, longitude: 78.47933 }, address: 'Hyderguda, Hyderabad',
  phone: '040-23231380', source: 'Hospital provider', sourceUrl: 'https://example.org/hospital',
  sourceReviewedAt: '2026-11-20', verificationStatus: 'GENERAL_DIRECTORY',
  sourceProvenance: 'OFFICIAL_SOURCE', currentAvailability: 'UNKNOWN',
  capabilities: ['Trauma care', 'Ambulance service'], outsideSearchRadius: true,
};
const response = (records: EmergencyFacility[]): EmergencyFacilitiesResponse => ({
  facilities: records, count: records.length, sourceAttribution: 'Test directory', disclaimer: 'Call to confirm',
});

describe('Facility provenance and refreshed searches', () => {
  it('does not promote a sourced directory listing to officially verified', () => {
    render(<LanguageProvider defaultLanguage="en"><FacilityCard facility={facility} onSelectAsDestination={vi.fn()} /></LanguageProvider>);
    expect(screen.getByText('Directory listing')).toBeInTheDocument();
    expect(screen.queryByText(/officially verified/i)).toBeNull();
    expect(screen.getByText('Outside selected radius')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Directory source' })).toHaveAttribute('href', facility.sourceUrl);
    expect(screen.getByRole('link', { name: '040-23231380' })).toHaveAttribute('href', 'tel:04023231380');
  });

  it('supports documented trauma capability while retaining the hospital category', async () => {
    const spy = vi.spyOn(service, 'getEmergencyFacilities').mockResolvedValue(response([facility]));
    try {
      render(<LanguageProvider defaultLanguage="en"><FacilitiesPage location={{ name: 'Hyderabad', lat: 17.385, lon: 78.4867 }} /></LanguageProvider>);
      await screen.findByText(facility.name);
      fireEvent.click(screen.getByRole('button', { name: 'Trauma care' }));
      await screen.findByText(facility.name);
      expect(spy).toHaveBeenLastCalledWith(17.385, 78.4867, 'TRAUMA_CENTRE', 25000);
    } finally { spy.mockRestore(); }
  });

  it('ignores an old response after the location changes', async () => {
    let resolveOld!: (value: EmergencyFacilitiesResponse) => void;
    const oldResponse = new Promise<EmergencyFacilitiesResponse>((resolve) => { resolveOld = resolve; });
    const spy = vi.spyOn(service, 'getEmergencyFacilities').mockReturnValueOnce(oldResponse)
      .mockResolvedValue(response([{ ...facility, name: 'New location hospital' }]));
    try {
      const page = (lat: number) => <LanguageProvider defaultLanguage="en"><FacilitiesPage location={{ name: 'Selected location', lat, lon: 78.4867 }} /></LanguageProvider>;
      const { rerender } = render(page(17.385));
      rerender(page(17.4));
      await screen.findByText('New location hospital');
      await act(async () => resolveOld(response([facility])));
      await waitFor(() => expect(screen.queryByText(facility.name)).toBeNull());
      expect(screen.getByText('New location hospital')).toBeInTheDocument();
    } finally { spy.mockRestore(); }
  });
});
