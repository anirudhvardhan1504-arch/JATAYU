import { config } from '../config.js';
import {
  AIChatMessage,
  AIChatRequest,
  AIChatResponse,
  AIStatusResponse,
  SupportedLanguage,
} from '../types/ai.types.js';
import { groundedAiService } from './groundedAi.service.js';

export class OpenRouterService {
  private apiKey: string | null;
  private model: string;
  private baseUrl: string;

  constructor() {
    this.apiKey = config.openRouter.apiKey;
    this.model = config.openRouter.model;
    this.baseUrl = config.openRouter.baseUrl;
  }

  public isConfigured(): boolean {
    return Boolean(this.apiKey && this.apiKey.length > 5 && !this.apiKey.includes('your_openrouter'));
  }

  public getStatus(): AIStatusResponse {
    const configured = this.isConfigured();
    return {
      configured,
      provider: 'OpenRouter',
      model: this.model,
      message: configured
        ? `OpenRouter AI service configured and active using model: ${this.model}`
        : 'OpenRouter API key is not set. The platform runs in scaffolding mode. Set OPENROUTER_API_KEY in backend/.env to activate live generative assistance.',
    };
  }

  private resolveLanguage(request: AIChatRequest): SupportedLanguage {
    if (request.language && ['en', 'ta', 'hi'].includes(request.language)) {
      return request.language;
    }
    // Backward-compatible fallback: inspect latest user message script
    if (Array.isArray(request.messages)) {
      for (let i = request.messages.length - 1; i >= 0; i--) {
        const msg = request.messages[i];
        if (msg.role === 'user' && typeof msg.content === 'string') {
          if (/[\u0B80-\u0BFF]/.test(msg.content)) return 'ta';
          if (/[\u0900-\u097F]/.test(msg.content)) return 'hi';
        }
      }
    }
    return 'en';
  }

  private buildDeterministicSitrep(lang: SupportedLanguage, context?: any): string {
    if (!context || typeof context !== 'object') {
      return '';
    }

    let sector = 'Selected Sector';
    if (typeof context.location === 'string') {
      sector = context.location;
    } else if (context.location?.name) {
      sector = context.location.name;
    } else if (context.sector) {
      sector = context.sector;
    } else if (lang === 'ta') {
      sector = 'தேர்ந்தெடுக்கப்பட்ட பகுதி';
    } else if (lang === 'hi') {
      sector = 'चयनित क्षेत्र';
    }

    let coords = lang === 'ta' ? 'ஆயத்தொலைவுகள் இணைக்கப்பட்டுள்ளன' : lang === 'hi' ? 'निर्देशांक संलग्न हैं' : 'Coordinates Attached';
    const lat = context.latitude ?? context.location?.latitude ?? context.coordinates?.lat;
    const lon = context.longitude ?? context.location?.longitude ?? context.coordinates?.lon;
    if (typeof lat === 'number' && typeof lon === 'number') {
      coords = `${lat.toFixed(4)}°N, ${lon.toFixed(4)}°E`;
    }

    const temp = context.weather?.temperatureC !== undefined ? `${context.weather.temperatureC}°C` : (lang === 'ta' ? 'செயல்பாட்டில் உள்ளது' : lang === 'hi' ? 'टेलीमेट्री प्रगति पर है' : 'Telemetry in progress');
    const precip = context.weather?.precipitationMm !== undefined ? `${context.weather.precipitationMm} mm/h` : '0.0 mm/h';
    const wind = context.weather?.windSpeedKmh !== undefined ? `${context.weather.windSpeedKmh} km/h` : (lang === 'ta' ? 'அமைதியானது' : lang === 'hi' ? 'शांत' : 'Calm');
    const riskLvl = context.floodRisk?.category || context.floodRisk?.level || context.risk?.overallRiskLevel || 'GUARDED';
    const riskScore = context.floodRisk?.score !== undefined ? `${context.floodRisk.score}/100` : (context.risk?.riskScore !== undefined ? `${context.risk.riskScore}/100` : (lang === 'ta' ? 'திரையிடல் தயார்' : lang === 'hi' ? 'स्क्रीनिंग तैयार' : 'Screening ready'));

    let alertsCount = context.alerts?.activeCount ?? context.alerts?.officialCount ?? 0;
    let highestAlert = context.alerts?.highestSeverity;
    if (!highestAlert && Array.isArray(context.alerts?.alerts)) {
      alertsCount = context.alerts.alerts.length;
      const sevs = context.alerts.alerts.map((a: any) => a.severity);
      if (sevs.includes('EMERGENCY')) highestAlert = 'EMERGENCY';
      else if (sevs.includes('WARNING')) highestAlert = 'WARNING';
      else if (sevs.includes('WATCH')) highestAlert = 'WATCH';
      else if (sevs.includes('ADVISORY')) highestAlert = 'ADVISORY';
      else highestAlert = lang === 'ta' ? 'செயலில் உள்ள எச்சரிக்கைகள் இல்லை' : lang === 'hi' ? 'कोई सक्रिय चेतावनी नहीं' : 'NO ACTIVE WARNINGS';
    } else if (!highestAlert) {
      highestAlert = lang === 'ta' ? 'செயலில் உள்ள எச்சரிக்கைகள் இல்லை' : lang === 'hi' ? 'कोई सक्रिय चेतावनी नहीं' : 'NO ACTIVE WARNINGS';
    }

    if (lang === 'ta') {
      const staleNotice = context.weather?.isStale
        ? `\n• காலாவதியான தொலைத்தொடர்பு ஆலோசனை: வானிலை அவதானிப்பு தாமதம் 90 நிமிடங்களை தாண்டியுள்ளது.`
        : '';
      return (
        `\n\n════════════════════════════════════════════════════════════════\n` +
        `திட்டவட்டமான சூழ்நிலை தொலைத்தொடர்பு (${sector.toUpperCase()})\n` +
        `════════════════════════════════════════════════════════════════\n` +
        `• இலக்கு ஆயத்தொலைவு: ${coords}\n` +
        `• கவனிக்கப்பட்ட வானிலை (Open-Meteo NWP): வெப்பநிலை ${temp} | மழை ${precip} | காற்று ${wind}\n` +
        `• உத்தேச வெள்ள அபாயம் (ஹியூரிஸ்டிக் திரையிடல்): ${riskLvl} (மதிப்பெண்: ${riskScore})\n` +
        `• அதிகாரப்பூர்வ எச்சரிக்கைகள் (IMD Nowcast RSS): ${alertsCount} செயலில் (${highestAlert})${staleNotice}\n` +
        `• தோற்றப் பிரிப்பு: அதிகாரப்பூர்வ IMD எச்சரிக்கைகள் vs சரிபார்க்கப்படாத உள் வெள்ள திரையிடல்\n` +
        `════════════════════════════════════════════════════════════════\n` +
        `*குறிப்பு: மேலே உள்ள நிகழ்நேர செயல்பாட்டுத் தொலைத்தொடர்பு ஜடாயு மைய சேவைகளால் திட்டவட்டமாக வழங்கப்படுகிறது.*`
      );
    }

    if (lang === 'hi') {
      const staleNotice = context.weather?.isStale
        ? `\n• पुराना टेलीमेट्री परामर्श: मौसम अवलोकन विलंबता 90 मिनट से अधिक है।`
        : '';
      return (
        `\n\n════════════════════════════════════════════════════════════════\n` +
        `नियत स्थितिजन्य टेलीमेट्री (${sector.toUpperCase()})\n` +
        `════════════════════════════════════════════════════════════════\n` +
        `• लक्षित निर्देशांक: ${coords}\n` +
        `• प्रेक्षित मौसम विज्ञान (Open-Meteo NWP): तापमान ${temp} | वर्षा ${precip} | हवा ${wind}\n` +
        `• आंतरिक सांकेतिक जोखिम (अनुमानी स्क्रीनिंग): ${riskLvl} (स्कोर: ${riskScore})\n` +
        `• आधिकारिक चेतावनियाँ (IMD Nowcast RSS): ${alertsCount} सक्रिय (${highestAlert})${staleNotice}\n` +
        `• उद्गम पृथक्करण: आधिकारिक IMD चेतावनियाँ बनाम असत्यापित आंतरिक बाढ़ स्क्रीनिंग\n` +
        `════════════════════════════════════════════════════════════════\n` +
        `*नोट: उपरोक्त वास्तविक समय परिचालन टेलीमेट्री जटायु कोर सेवाओं द्वारा नियत रूप से प्रदान की जाती है।*`
      );
    }

    const staleNotice = context.weather?.isStale
      ? `\n• Stale Telemetry Advisory: Weather observation latency exceeds 90 minutes.`
      : '';
    return (
      `\n\n════════════════════════════════════════════════════════════════\n` +
      `DETERMINISTIC SITUATIONAL TELEMETRY (${sector.toUpperCase()})\n` +
      `════════════════════════════════════════════════════════════════\n` +
      `• Target Fix: ${coords}\n` +
      `• Observed Meteorology (Open-Meteo NWP): Temp ${temp} | Rain ${precip} | Wind ${wind}\n` +
      `• Internal Indicative Risk (Heuristic Screening): ${riskLvl} (Score: ${riskScore})\n` +
      `• Official Warnings (IMD Nowcast RSS): ${alertsCount} Active (${highestAlert})${staleNotice}\n` +
      `• Provenance Separation: Official IMD warnings vs unvalidated internal flood screening\n` +
      `════════════════════════════════════════════════════════════════\n` +
      `*Note: Real-time operational telemetry above is provided deterministically by JATAYU core services.*`
    );
  }

  public async generateChatResponse(request: AIChatRequest): Promise<AIChatResponse> {
    const timestamp = new Date().toISOString();
    const lang = this.resolveLanguage(request);
    const lastUserMsg = Array.isArray(request.messages)
      ? [...request.messages].reverse().find((m) => m.role === 'user')?.content || ''
      : '';

    if (!this.isConfigured()) {
      const groundedResult = groundedAiService.generateGroundedResponse(lastUserMsg, lang, request.context);
      const sitrep = this.buildDeterministicSitrep(lang, request.context);

      let headerNotice = '';
      if (lang === 'ta') {
        headerNotice =
          `[ஜடாயு பேரிடர் AI — ஓபன்ரூட்டர் கேட்வே அறிவிப்பு]\n\n` +
          `ஹோஸ்ட் சூழலில் OPENROUTER_API_KEY உள்ளமைக்கப்படாததால், உருவாக்கும் AI அனுமான நுழைவாயில் வெளிப்படையான சாரக்கட்டு பயன்முறையில் இயங்குகிறது.\n\n` +
          `• இலக்கு இயந்திரம்: OpenRouter (${this.model})\n` +
          `• தேவையான கட்டமைப்பு: நேரடி நரம்பியல் உரையாடல் காரணத்தை செயல்படுத்த .env அல்லது கொள்கலன் சூழலில் OPENROUTER_API_KEY ஐ அமைக்கவும்.`;
      } else if (lang === 'hi') {
        headerNotice =
          `[जटायु आपदा AI — ओपनरूटर गेटवे सूचना]\n\n` +
          `होस्ट वातावरण में OPENROUTER_API_KEY कॉन्फ़िगर नहीं होने के कारण जनरेटिव AI इंफ़रेंस गेटवे पारदर्शी पाड़ मोड में काम कर रहा है।\n\n` +
          `• लक्षित इंजन: OpenRouter (${this.model})\n` +
          `• आवश्यक कॉन्फ़िगरेशन: लाइव न्यूरल संवादात्मक तर्क को सक्रिय करने के लिए .env या कंटेनर वातावरण में OPENROUTER_API_KEY सेट करें।`;
      } else {
        headerNotice =
          `[JATAYU DISASTER AI — OPENROUTER GATEWAY NOTICE]\n\n` +
          `The generative AI inference gateway is operating in transparent scaffolding mode because OPENROUTER_API_KEY is not configured in the host environment.\n\n` +
          `• Target Engine: OpenRouter (${this.model})\n` +
          `• Required Configuration: Set OPENROUTER_API_KEY in .env or container environment to activate live neural conversational reasoning.`;
      }

      const combinedContent = headerNotice + (sitrep ? `\n\n${sitrep}` : '') + `\n\n${groundedResult.fullMarkdown}`;

      return {
        configured: false,
        model: this.model,
        timestamp,
        message: {
          role: 'assistant',
          content: combinedContent,
        },
      };
    }

    try {
      let languageGuideline = '5. Respond in clear, operational English.';
      if (lang === 'ta') {
        languageGuideline = '5. You MUST respond fluently, accurately, and professionally in Tamil (தமிழ்) script. Maintain calm, operational disaster-intelligence tone.';
      } else if (lang === 'hi') {
        languageGuideline = '5. You MUST respond fluently, accurately, and professionally in Hindi (हिन्दी) Devanagari script. Maintain calm, operational disaster-intelligence tone.';
      }

      // Build disaster-intelligence system prompt enforcing strict 5-part contract
      const systemPrompt: AIChatMessage = {
        role: 'system',
        content:
          `You are JATAYU Grounded Operational Disaster Intelligence Assistant.\n` +
          `Follow strict protocols:\n` +
          `1. Answer must follow this EXACT 5-part structure with markdown headings:\n` +
          `   ### 1. What We Know (authoritative facts only from context)\n` +
          `   ### 2. Source and Time (exact provider and timestamps)\n` +
          `   ### 3. What is Uncertain (explicit gaps, unknown shelter vacancies, unvalidated models)\n` +
          `   ### 4. What to Do Next (actionable life safety guidance)\n` +
          `   ### 5. Where to Get Help (helplines: 112, 1070, 1077, 1913/1916, 108, and shelter contacts)\n` +
          `2. Distinguish clearly between observed meteorological telemetry, official IMD warnings, and indicative models.\n` +
          `3. NEVER fabricate shelter vacancy or declare false safety guarantees. Shelter availability is ALWAYS UNKNOWN without dispatch check.\n` +
          `4. SFINCS hydrodynamic simulations are strictly unvalidated research models and MUST NEVER be reported as civil evacuation orders.\n` +
          `${languageGuideline}\n` +
          (request.context
            ? `\nCurrent Operational Context: ${JSON.stringify(request.context)}`
            : ''),
      };

      const messages = [systemPrompt, ...request.messages];

      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
          'HTTP-Referer': 'https://jatayu.disaster-intel.local',
          'X-Title': 'JATAYU Disaster Intelligence Platform',
        },
        body: JSON.stringify({
          model: this.model,
          messages,
          temperature: 0.2,
          max_tokens: 1000,
        }),
        signal: AbortSignal.timeout(20000), // 20-second timeout guard
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`OpenRouter API error ${response.status}: ${errorText}`);
      }

      const data = (await response.json()) as any;
      const content =
        data.choices?.[0]?.message?.content ||
        'No intelligence narrative generated by inference provider.';

      return {
        configured: true,
        model: this.model,
        timestamp,
        message: {
          role: 'assistant',
          content,
        },
      };
    } catch (err: any) {
      console.warn(`[JATAYU AI] Inference upstream failure (${err.message}), falling back to deterministic grounded response.`);
      const groundedResult = groundedAiService.generateGroundedResponse(lastUserMsg, lang, request.context);

      return {
        configured: false,
        model: this.model,
        timestamp,
        message: {
          role: 'assistant',
          content: `[JATAYU DISASTER AI — DEGRADED RETRIEVAL FALLBACK (Upstream Provider Unavailable)]\n\n` + groundedResult.fullMarkdown,
        },
      };
    }
  }
}
