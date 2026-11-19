import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PreparednessPage } from '../pages/PreparednessPage';

describe('Citizen Emergency Go-Bag & Disaster Protocols Integration', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  const mockLocation = { name: 'Chennai Metropolitan Area', lat: 13.0827, lon: 80.2707 };

  it('renders all 9 emergency go-bag supplies with initial progress 0%', () => {
    render(
      <PreparednessPage
        location={mockLocation}
        weather={null}
        riskAssessment={null}
        alertFeed={null}
      />
    );

    expect(screen.getByText(/Citizen Emergency "Go-Bag" Essential Kit/i)).toBeInTheDocument();
    expect(screen.getByText('0% COMPLETE')).toBeInTheDocument();
    expect(screen.getByText('9 remaining to pack')).toBeInTheDocument();

    // Check specific items
    expect(screen.getByText(/Drinking Water \(3-5 Litres per Person per Day\)/i)).toBeInTheDocument();
    expect(screen.getByText(/Non-Perishable Food & High-Energy Rations/i)).toBeInTheDocument();
    expect(screen.getByText(/First-Aid Kit & Antiseptic Supplies/i)).toBeInTheDocument();
    expect(screen.getByText(/Essential Chronic & Prescription Medicines/i)).toBeInTheDocument();
    expect(screen.getByText(/High-Intensity LED Flashlight & Spare Batteries/i)).toBeInTheDocument();
    expect(screen.getByText(/Charged Power Bank & Charging Cables/i)).toBeInTheDocument();
    expect(screen.getByText(/Important Documents in Waterproof Pouch/i)).toBeInTheDocument();
    expect(screen.getByText(/Laminated Emergency Contact Directory/i)).toBeInTheDocument();
    expect(screen.getByText(/Loud Emergency Whistle \/ Signaling Device/i)).toBeInTheDocument();
  });

  it('interactively checks off go-bag items and updates completion counter and progress bar', () => {
    render(
      <PreparednessPage
        location={mockLocation}
        weather={null}
        riskAssessment={null}
        alertFeed={null}
      />
    );

    const waterItem = screen.getByText(/Drinking Water \(3-5 Litres per Person per Day\)/i);
    fireEvent.click(waterItem);

    // Progress updates to 11% (1/9)
    expect(screen.getByText('11% COMPLETE')).toBeInTheDocument();
    expect(screen.getByText('8 remaining to pack')).toBeInTheDocument();

    // Pack second item
    const firstAidItem = screen.getByText(/First-Aid Kit & Antiseptic Supplies/i);
    fireEvent.click(firstAidItem);

    // Progress updates to 22% (2/9)
    expect(screen.getByText('22% COMPLETE')).toBeInTheDocument();
    expect(screen.getByText('7 remaining to pack')).toBeInTheDocument();

    // Reset button clears progress
    const resetButton = screen.getByTitle('Reset checklist progress');
    fireEvent.click(resetButton);

    expect(screen.getByText('0% COMPLETE')).toBeInTheDocument();
    expect(screen.getByText('9 remaining to pack')).toBeInTheDocument();
  });

  it('allows switching between disaster-specific protocols (Flood, Cyclone, Extreme Rain)', () => {
    render(
      <PreparednessPage
        location={mockLocation}
        weather={null}
        riskAssessment={null}
        alertFeed={null}
      />
    );

    // Default is Flood: Before Flood
    expect(screen.getByText('1. Clear Drainage & Gullies')).toBeInTheDocument();

    // Switch to During Flood
    fireEvent.click(screen.getByText('2. During Flood'));
    expect(screen.getByText('1. Disconnect Electrical Mains')).toBeInTheDocument();
    expect(screen.getByText(/Turn Around, Don't Drown/i)).toBeInTheDocument();

    // Switch to After Flood
    fireEvent.click(screen.getByText('3. After Flood'));
    expect(screen.getByText('1. Water & Food Sanitation')).toBeInTheDocument();
    expect(screen.getByText(/Reptile & Electric Hazard Checks/i)).toBeInTheDocument();

    // Switch to Cyclone
    fireEvent.click(screen.getByRole('button', { name: /Cyclone/i }));
    expect(screen.getByText('1. Trim Branches & Secure Fixtures')).toBeInTheDocument();

    // Switch to Extreme Rain
    fireEvent.click(screen.getByRole('button', { name: /Extreme Rain/i }));
    expect(screen.getByText('1. Basement & Vehicle Precautions')).toBeInTheDocument();
  });
});
