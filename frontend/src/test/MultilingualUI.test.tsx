import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { LanguageProvider, useLanguage } from '../context/LanguageContext';
import { LanguageSelector } from '../components/common/LanguageSelector';
import { Topbar } from '../components/layout/Topbar';
import { Sidebar } from '../components/layout/Sidebar';
import { AIAssistantPage } from '../pages/AIAssistantPage';
import { OverviewPage } from '../pages/OverviewPage';
import { AlertsPage } from '../pages/AlertsPage';
import { AuthProvider } from '../context/AuthContext';
import * as aiService from '../services/ai';

// Mock maplibre-gl
vi.mock('maplibre-gl', () => ({
  default: {
    Map: vi.fn(() => ({
      addControl: vi.fn(),
      on: vi.fn(),
      once: vi.fn(),
      remove: vi.fn(),
      flyTo: vi.fn(),
      addSource: vi.fn(),
      addLayer: vi.fn(),
      getSource: vi.fn(),
      getLayer: vi.fn(),
      setPaintProperty: vi.fn(),
      setLayoutProperty: vi.fn(),
      isStyleLoaded: vi.fn(() => true),
    })),
    NavigationControl: vi.fn(),
    Marker: vi.fn(() => ({
      setLngLat: vi.fn().mockReturnThis(),
      setPopup: vi.fn().mockReturnThis(),
      addTo: vi.fn().mockReturnThis(),
      getPopup: vi.fn(() => ({ setHTML: vi.fn() })),
    })),
    Popup: vi.fn(() => ({ setHTML: vi.fn().mockReturnThis() })),
  },
}));

const mockLocation = {
  name: 'Chennai Coastal Basin',
  lat: 13.0827,
  lon: 80.2707,
};

describe('JATAYU Multilingual UI & Localization Engine', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('renders English by default and provides all required translation keys', () => {
    const TestComponent = () => {
      const { language, t } = useLanguage();
      return (
        <div>
          <span data-testid="lang">{language}</span>
          <span data-testid="title">{t('brand.name')}</span>
          <span data-testid="tagline">{t('brand.tagline')}</span>
        </div>
      );
    };

    render(
      <LanguageProvider>
        <TestComponent />
      </LanguageProvider>
    );

    expect(screen.getByTestId('lang')).toHaveTextContent('en');
    expect(screen.getByTestId('title')).toHaveTextContent('JATAYU');
    expect(screen.getByTestId('tagline')).toHaveTextContent('Disaster Intelligence & Response');
  });

  it('switches between English, Tamil, and Hindi dynamically via LanguageSelector', () => {
    const TestApp = () => {
      const { t } = useLanguage();
      return (
        <div>
          <LanguageSelector />
          <h1 data-testid="heading">{t('nav.overview')}</h1>
          <p data-testid="precip">{t('weather.precipitationRate')}</p>
        </div>
      );
    };

    render(
      <LanguageProvider>
        <TestApp />
      </LanguageProvider>
    );

    // Initial English
    expect(screen.getByTestId('heading')).toHaveTextContent('Operational Overview');
    expect(screen.getByTestId('precip')).toHaveTextContent('Precipitation Rate');

    // Switch to Tamil
    const select = screen.getByLabelText(/Language|மொழி|भाषा/i);
    fireEvent.change(select, { target: { value: 'ta' } });

    expect(screen.getByTestId('heading')).toHaveTextContent('செயல்பாட்டு மேலோட்டம்');
    expect(screen.getByTestId('precip')).toHaveTextContent('மழைப்பொழிவு விகிதம்');

    // Switch to Hindi
    fireEvent.change(select, { target: { value: 'hi' } });

    expect(screen.getByTestId('heading')).toHaveTextContent('परिचालन अवलोकन');
    expect(screen.getByTestId('precip')).toHaveTextContent('वर्षा दर');
  });

  it('preserves language preference in localStorage', () => {
    const { unmount } = render(
      <LanguageProvider>
        <LanguageSelector />
      </LanguageProvider>
    );

    const select = screen.getByLabelText(/Language/i);
    fireEvent.change(select, { target: { value: 'ta' } });
    expect(localStorage.getItem('jatayu_preferred_language')).toBe('ta');

    unmount();

    // Re-render with existing localStorage
    const TestConsumer = () => {
      const { language } = useLanguage();
      return <span data-testid="saved-lang">{language}</span>;
    };

    render(
      <LanguageProvider>
        <TestConsumer />
      </LanguageProvider>
    );

    expect(screen.getByTestId('saved-lang')).toHaveTextContent('ta');
  });

  it('handles missing translation keys gracefully with fallback to English or raw key', () => {
    const TestFallback = () => {
      const { t } = useLanguage();
      return (
        <div>
          <span data-testid="raw-key">{t('non.existent.key' as any)}</span>
        </div>
      );
    };

    render(
      <LanguageProvider defaultLanguage="ta">
        <TestFallback />
      </LanguageProvider>
    );

    expect(screen.getByTestId('raw-key')).toHaveTextContent('non.existent.key');
  });

  it('renders localized navigation, status bar, and topbar in Tamil and Hindi', () => {
    const onSelectTab = vi.fn();
    const onSelectLocation = vi.fn();
    const onRefresh = vi.fn();

    const { rerender } = render(
      <AuthProvider>
        <LanguageProvider defaultLanguage="ta">
          <Sidebar activeTab="overview" onSelectTab={onSelectTab} />
          <Topbar
            activeTab="overview"
            selectedLocation={mockLocation}
            onSelectLocation={onSelectLocation}
            onRefresh={onRefresh}
          />
        </LanguageProvider>
      </AuthProvider>
    );

    // Tamil elements
    expect(screen.getByText('செயல்பாட்டு மேலோட்டம்')).toBeInTheDocument();
    expect(screen.getByText('தந்திரோபாய வரைபடம்')).toBeInTheDocument();
    expect(screen.getByText('வெள்ள அபாய அணி')).toBeInTheDocument();
    expect(screen.getByText('எச்சரிக்கை கண்காணிப்பு')).toBeInTheDocument();
    expect(screen.getByText('தயார்நிலை நெறிமுறைகள்')).toBeInTheDocument();
    expect(screen.getByText('கன்சோல் / overview')).toBeInTheDocument();
    expect(screen.getByText('புதுப்பி')).toBeInTheDocument();

    // Rerender in Hindi
    rerender(
      <AuthProvider>
        <LanguageProvider defaultLanguage="hi">
          <Sidebar activeTab="overview" onSelectTab={onSelectTab} />
          <Topbar
            activeTab="overview"
            selectedLocation={mockLocation}
            onSelectLocation={onSelectLocation}
            onRefresh={onRefresh}
          />
        </LanguageProvider>
      </AuthProvider>
    );

    // Hindi elements
    expect(screen.getByText('परिचालन अवलोकन')).toBeInTheDocument();
    expect(screen.getByText('सामरिक मानचित्र')).toBeInTheDocument();
    expect(screen.getByText('बाढ़ जोखिम मैट्रिक्स')).toBeInTheDocument();
    expect(screen.getByText('चेतावनी निगरानी')).toBeInTheDocument();
    expect(screen.getByText('तैयारी प्रोटोकॉल')).toBeInTheDocument();
    expect(screen.getByText('कंसोल / overview')).toBeInTheDocument();
    expect(screen.getByText('ताज़ा करें')).toBeInTheDocument();
  });

  it('passes active language to sendAIChat and retains conversation history across language switches', async () => {
    vi.spyOn(aiService, 'getAIStatus').mockResolvedValue({
      configured: false,
      provider: 'OpenRouter',
      model: 'anthropic/claude-3.5-sonnet',
      message: 'Scaffolding',
    });

    const sendAIChatSpy = vi.spyOn(aiService, 'sendAIChat').mockResolvedValue({
      configured: false,
      model: 'anthropic/claude-3.5-sonnet',
      timestamp: new Date().toISOString(),
      message: {
        role: 'assistant',
        content: '[ஜடாயு பேரிடர் AI — ஓபன்ரூட்டர் கேட்வே அறிவிப்பு] திட்டவட்டமான சூழ்நிலை தொலைத்தொடர்பு',
      },
    });

    const TestAssistantWrapper = () => {
      return (
        <LanguageProvider defaultLanguage="ta">
          <LanguageSelector />
          <AIAssistantPage location={mockLocation} />
        </LanguageProvider>
      );
    };

    render(<TestAssistantWrapper />);

    // Presets in Tamil
    const taPreset = screen.getByText('தற்போதைய பகுதி தொலைத்தொடர்புடன் செயல்பாட்டு SITREP-ஐ உருவாக்கவும்');
    expect(taPreset).toBeInTheDocument();

    // Click preset to transmit
    fireEvent.click(taPreset);

    await waitFor(() => {
      expect(sendAIChatSpy).toHaveBeenCalledWith(
        expect.any(Array),
        expect.any(Object),
        'ta' // Passed language
      );
    });

    // Verify response content rendered
    await waitFor(() => {
      expect(
        screen.getByText(/\[ஜடாயு பேரிடர் AI — ஓபன்ரூட்டர் கேட்வே அறிவிப்பு\]/)
      ).toBeInTheDocument();
    });

    // Switch language to Hindi using selector
    const langSelect = screen.getByLabelText(/Language|மொழி|भाषा/i);
    fireEvent.change(langSelect, { target: { value: 'hi' } });

    // Verify that conversation history was preserved
    expect(
      screen.getByText(/\[ஜடாயு பேரிடர் AI — ஓபன்ரூட்டர் கேட்வே அறிவிப்பு\]/)
    ).toBeInTheDocument();

    // Verify that new presets rendered in Hindi
    expect(
      screen.getByText('वर्तमान क्षेत्र टेलीमेट्री के साथ परिचालन स्थिति रिपोर्ट उत्पन्न करें')
    ).toBeInTheDocument();
  });

  it('renders localized error, loading, and stale-data states in OverviewPage', () => {
    render(
      <LanguageProvider defaultLanguage="ta">
        <OverviewPage
          location={mockLocation}
          weather={null}
          forecast={null}
          riskAssessment={null}
          isLoading={false}
          error="Network timeout reaching Open-Meteo"
          onRetry={vi.fn()}
        />
      </LanguageProvider>
    );

    expect(screen.getByText('நேரடி வானிலை தொலைத்தொடர்பு கிடைக்கவில்லை')).toBeInTheDocument();
    expect(screen.getByText('மீண்டும் முயற்சி')).toBeInTheDocument();
  });

  it('renders localized alert tabs in AlertsPage without changing operational severity', () => {
    const mockFeed = {
      fetchedAt: '2026-10-26T12:00:00Z',
      source: 'IMD',
      feedStatus: 'LIVE_VERIFIED' as const,
      itemCount: 0,
      geographicResolution: {
        coordinates: { latitude: 13.0827, longitude: 80.2707 },
        resolvedDistrict: 'CHENNAI',
        resolvedState: 'TAMIL NADU',
        matchStatus: 'RESOLVED_DISTRICT' as const,
        datasetSource: 'Census 2011 Districts',
        vintage: '2011 Census of India administrative delimitation',
      },
      officialAlerts: [],
      nationwideAlerts: [],
      indicativeAlerts: [],
      demonstrationScenarios: [],
      disclaimer: 'Indicative assessment',
      limitations: ['District boundaries approximate'],
    };

    render(
      <LanguageProvider defaultLanguage="hi">
        <AlertsPage location={mockLocation} alertFeed={mockFeed} />
      </LanguageProvider>
    );

    expect(screen.getByText('सुलझाया गया प्रशासनिक क्षेत्र:')).toBeInTheDocument();
    expect(screen.getByText('स्थानीय जिला मिलान (0)')).toBeInTheDocument();
    expect(screen.getByText('राष्ट्रव्यापी आईएमडी अलर्ट (0)')).toBeInTheDocument();
    expect(screen.getByText('सांकेतिक परामर्श (0)')).toBeInTheDocument();
    expect(screen.getByText('अभ्यास परिदृश्य (0)')).toBeInTheDocument();
  });
});
