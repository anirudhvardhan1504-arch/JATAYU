import React, { useState, useEffect, useRef } from 'react';
import {
  Send,
  BotMessageSquare,
  User,
  Server,
  Terminal,
  Activity,
  CloudRain,
  AlertTriangle,
  ShieldAlert,
  FileText,
} from 'lucide-react';
import { SectionHeader } from '../components/common/SectionHeader';
import { Badge } from '../components/common/Badge';
import {
  AIChatMessage,
  AIStatusResponse,
  CurrentWeatherObservation,
  WeatherForecastResponse,
  IndicativeFloodRiskAssessment,
  AlertFeedResponse,
} from '../types';
import { getAIStatus, sendAIChat } from '../services/ai';
import { AuthContext } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { generateTacticalSitrep } from '../utils/sitrepGenerator';
import { SitrepExportModal } from '../components/sitrep/SitrepExportModal';

interface AIAssistantPageProps {
  location: { name: string; lat: number; lon: number };
  weather?: CurrentWeatherObservation | null;
  forecast?: WeatherForecastResponse | null;
  riskAssessment?: IndicativeFloodRiskAssessment | null;
  alertFeed?: AlertFeedResponse | null;
}

export const AIAssistantPage: React.FC<AIAssistantPageProps> = ({
  location,
  weather,
  forecast,
  riskAssessment,
  alertFeed,
}) => {
  const authContext = React.useContext(AuthContext);
  const user = authContext?.user || null;
  const { t, language } = useLanguage();
  const [isSitrepModalOpen, setIsSitrepModalOpen] = useState(false);
  const [messages, setMessages] = useState<AIChatMessage[]>(() => [
    {
      role: 'assistant',
      content:
        `JATAYU Operational Disaster Intelligence Agent online.\n` +
        `Current Focus: ${location.name} (${location.lat.toFixed(4)}°N, ${location.lon.toFixed(4)}°E)\n\n` +
        `I am connected via server-side OpenRouter to assist emergency coordinators, provide structured SITREPs, and cross-reference standard operating procedures. How can I assist this operational shift?`,
    },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [aiStatus, setAiStatus] = useState<AIStatusResponse | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const prevLocationRef = useRef(location.name);

  const presetQueries = [
    t('ai.preset1'),
    t('ai.preset2'),
    t('ai.preset3'),
    t('ai.preset4'),
  ];

  useEffect(() => {
    getAIStatus()
      .then(setAiStatus)
      .catch((err) => console.warn('Failed to fetch AI status:', err));
  }, []);

  // When location changes, append a sector switch notice to the conversational transcript
  useEffect(() => {
    if (prevLocationRef.current !== location.name) {
      prevLocationRef.current = location.name;
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: `Operational Context Shift: Focus re-centered on ${location.name} (${location.lat.toFixed(4)}°N, ${location.lon.toFixed(4)}°E).\nActive telemetry synchronized.`,
        },
      ]);
    }
  }, [location]);

  useEffect(() => {
    if (typeof messagesEndRef.current?.scrollIntoView === 'function') {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  const handleSend = async (queryText?: string) => {
    const textToSend = queryText || input;
    if (!textToSend.trim() || isLoading) return;

    const newMessages: AIChatMessage[] = [
      ...messages,
      { role: 'user', content: textToSend.trim() },
    ];
    setMessages(newMessages);
    setInput('');
    setIsLoading(true);

    try {
      // Build rich operational telemetry payload
      const telemetryContext = {
        location: location.name,
        latitude: location.lat,
        longitude: location.lon,
        resolvedDistrict: alertFeed?.geographicResolution?.resolvedDistrict || null,
        weather: weather
          ? {
              temperatureC: weather.temperatureC,
              apparentTemperatureC: weather.apparentTemperatureC,
              precipitationMm: weather.precipitationMm,
              condition: weather.weatherDescription,
              windSpeedKmh: weather.windSpeedKmh,
              soilMoisture: weather.soilMoisture0To7cm,
            }
          : null,
        forecast: forecast
          ? {
              next24hRainfallMm: forecast.accumulations?.next24hRainfallMm,
              next72hRainfallMm: forecast.accumulations?.next72hRainfallMm,
              saturationTier: forecast.soilProfile?.saturationTier,
            }
          : null,
        floodRisk: riskAssessment
          ? {
              score: riskAssessment.riskScore,
              category: riskAssessment.overallRiskLevel,
              factors: riskAssessment.factors,
              summary: riskAssessment.explanation?.summary,
            }
          : null,
        alerts: alertFeed
          ? {
              activeCount: alertFeed.itemCount,
              alerts: (alertFeed.officialAlerts || []).map((a) => ({
                id: a.id,
                title: a.headline,
                severity: a.severity,
                district: a.affectedArea?.name,
              })),
            }
          : null,
      };

      const response = await sendAIChat(newMessages, telemetryContext, language);
      setMessages((prev) => [...prev, response.message]);
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: `Operational Communication Failure: ${err.message || 'Unknown network error'}.`,
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const riskLevel = riskAssessment?.overallRiskLevel ?? 'LOW';
  const riskColor =
    riskLevel === 'CRITICAL' || riskLevel === 'HIGH'
      ? 'text-red-300 bg-red-950/80 border-red-500/40'
      : riskLevel === 'ELEVATED' || riskLevel === 'GUARDED'
      ? 'text-amber-300 bg-amber-950/80 border-amber-500/40'
      : 'text-emerald-300 bg-emerald-950/80 border-emerald-500/40';

  return (
    <div className="space-y-6">
      <SectionHeader
        title={t('ai.title')}
        subtitle={t('ai.subtitle', { location: location.name })}
        badge={<Badge variant="navy">{t('ai.badge')}</Badge>}
        action={
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={() => setIsSitrepModalOpen(true)}
              className="px-3.5 py-1.5 bg-dark-emerald/70 hover:bg-dark-emerald text-amber-300 border border-amber-500/40 rounded-xl text-xs font-mono font-bold flex items-center gap-1.5 shadow-[0_0_10px_rgba(245,158,11,0.15)] transition-all cursor-pointer"
              title="Export Tactical Situation Report"
            >
              <FileText className="w-3.5 h-3.5 text-amber-400" />
              <span>{t('sitrep.exportBtn')}</span>
            </button>
            <span className="text-xs font-mono text-jatayu-muted">{t('ai.gateway')}</span>
            {aiStatus?.configured ? (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-semibold bg-emerald-950/80 text-emerald-300 border border-emerald-500/40 shadow-[0_0_8px_rgba(0,217,154,0.2)]">
                {t('ai.active')} ({aiStatus.model})
              </span>
            ) : (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-semibold bg-amber-950/80 text-amber-300 border border-amber-500/40">
                {t('ai.scaffolding')}
              </span>
            )}
          </div>
        }
      />

      {/* Live Sector Operational Context Ribbon */}
      <div className="bento-card p-3.5 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2.5">
          <Activity className="w-4 h-4 text-emerald-400 animate-pulse" />
          <span className="font-mono font-bold text-jatayu-primary">{location.name}</span>
          <span className="text-jatayu-muted font-mono">
            [{location.lat.toFixed(2)}°N, {location.lon.toFixed(2)}°E]
          </span>
        </div>

        <div className="flex items-center gap-4 flex-wrap">
          {/* Weather */}
          <div className="flex items-center gap-1.5 text-jatayu-secondary font-sans">
            <CloudRain className="w-3.5 h-3.5 text-emerald-400" />
            <span>
              {weather ? `${weather.weatherDescription} (${weather.precipitationMm} mm/h)` : 'Weather: Pending'}
            </span>
          </div>

          {/* Risk */}
          <div className={`px-2.5 py-0.5 rounded-full border text-[11px] font-mono font-bold flex items-center gap-1.5 ${riskColor}`}>
            <ShieldAlert className="w-3 h-3" />
            <span>RISK: {riskAssessment ? `${riskAssessment.riskScore}/100 [${riskAssessment.overallRiskLevel}]` : 'N/A'}</span>
          </div>

          {/* Alerts */}
          <div className="flex items-center gap-1 text-jatayu-secondary font-mono">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
            <span>{alertFeed ? `${alertFeed.itemCount} IMD NOTICES` : '0 NOTICES'}</span>
          </div>
        </div>
      </div>

      {/* Gateway Information Callout */}
      {!aiStatus?.configured && (
        <div className="p-4 bg-obsidian/70 border border-white/10 rounded-2xl shadow-panel flex items-start gap-3 backdrop-blur-md">
          <Server className="w-5 h-5 text-emerald-400 mt-0.5 flex-shrink-0" />
          <div className="text-xs text-jatayu-secondary leading-relaxed">
            <p className="font-bold uppercase tracking-wider font-mono text-[11px] text-jatayu-primary">
              OpenRouter Operational Scaffolding Mode
            </p>
            <p className="mt-0.5">
              The AI service is operating in deterministic scaffolding mode without fabricating hallucinated responses.
              Queries are synthesized using live Open-Meteo observations, IMD nowcast feeds, and indicative flood risk heuristics.
              To activate external LLM inference, configure <code className="bg-charcoal px-1.5 py-0.5 rounded font-mono text-emerald-300 border border-white/10">OPENROUTER_API_KEY</code> on the backend.
            </p>
          </div>
        </div>
      )}

      {/* Preset Operational Prompts */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-mono text-emerald-400 mr-1 flex items-center gap-1.5">
          <Terminal className="w-3.5 h-3.5" />
          QUICK QUESTIONS:
        </span>
        {presetQueries.map((q, idx) => (
          <button
            key={idx}
            onClick={() => handleSend(q)}
            disabled={isLoading}
            className="px-3 py-1.5 text-xs font-sans rounded-xl bg-charcoal/80 border border-white/10 hover:border-emerald-500/40 text-jatayu-secondary hover:text-jatayu-primary shadow-subtle transition-all cursor-pointer disabled:opacity-50"
          >
            {q}
          </button>
        ))}
      </div>

      {/* Terminal-Style Conversational Thread */}
      <div className="bento-card flex flex-col h-[520px] overflow-hidden">
        {/* Messages Scroll Area */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {messages.map((msg, index) => {
            const isUser = msg.role === 'user';
            return (
              <div
                key={index}
                className={`flex items-start gap-3 ${isUser ? 'flex-row-reverse' : ''}`}
              >
                <div
                  className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 text-xs font-mono ${
                    isUser
                      ? 'bg-emerald-600 text-white shadow-[0_0_10px_rgba(0,217,154,0.3)]'
                      : 'bg-dark-emerald/70 border border-emerald-500/40 text-emerald-400 shadow-[0_0_10px_rgba(0,217,154,0.2)]'
                  }`}
                >
                  {isUser ? <User className="w-4 h-4" /> : <BotMessageSquare className="w-4 h-4" />}
                </div>

                <div
                  className={`p-4 rounded-2xl text-xs max-w-2xl leading-relaxed whitespace-pre-wrap font-sans ${
                    isUser
                      ? 'bg-emerald-950/70 border border-emerald-500/30 text-white shadow-subtle'
                      : 'bg-obsidian/70 border border-white/10 text-jatayu-primary shadow-subtle'
                  }`}
                >
                  {msg.content}
                </div>
              </div>
            );
          })}
          {isLoading && (
            <div className="flex items-center gap-2 text-xs font-mono text-emerald-400 py-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_6px_#00D99A]"></span>
              <span>SYNTHESIZING OPERATIONAL BRIEFING WITH SECTOR TELEMETRY...</span>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Chat Input Bar */}
        <div className="p-3.5 border-t border-white/10 bg-obsidian/60 flex items-center gap-2.5">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSend();
            }}
            placeholder={t('ai.inputPlaceholder')}
            disabled={isLoading}
            className="flex-1 bg-charcoal/80 border border-white/10 rounded-xl px-4 py-2 text-xs text-jatayu-primary placeholder:text-jatayu-muted outline-none focus:border-emerald-500/60 font-sans transition-colors"
          />
          <button
            onClick={() => handleSend()}
            disabled={isLoading || !input.trim()}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-mono font-medium rounded-xl flex items-center gap-1.5 disabled:opacity-40 transition-all shadow-[0_0_15px_rgba(0,217,154,0.3)] cursor-pointer"
          >
            <Send className="w-3.5 h-3.5" />
            <span>{t('ai.send')}</span>
          </button>
        </div>
      </div>

      <SitrepExportModal
        isOpen={isSitrepModalOpen}
        onClose={() => setIsSitrepModalOpen(false)}
        sitrepMarkdown={generateTacticalSitrep({
          location,
          weather: weather || null,
          forecast: forecast || null,
          riskAssessment: riskAssessment || null,
          alertFeed: alertFeed || null,
          language,
          user,
        })}
        locationName={location.name}
      />
    </div>
  );
};

export default AIAssistantPage;
