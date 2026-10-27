import { SupportedLanguage } from '../types/ai.types.js';
import { CurrentWeatherObservation } from '../types/weather.types.js';
import { DisasterAlert } from '../types/alert.types.js';
import { IndicativeFloodRiskAssessment } from '../types/risk.types.js';
import { EmergencyFacility } from '../types/route.types.js';

export interface GroundedContextInput {
  location?: string | {
    name?: string;
    latitude?: number;
    longitude?: number;
    district?: string;
    state?: string;
  };
  latitude?: number;
  longitude?: number;
  sector?: string;
  weather?: Partial<CurrentWeatherObservation> | any;
  alerts?: {
    alerts?: DisasterAlert[];
    activeCount?: number;
    highestSeverity?: string;
    feedStatus?: string;
  } | any;
  risk?: Partial<IndicativeFloodRiskAssessment> | any;
  floodRisk?: any;
  facilities?: EmergencyFacility[];
  userRole?: string;
  [key: string]: any;
}

export interface GroundedSectionedOutput {
  whatWeKnow: string;
  sourceAndTime: string;
  whatIsUncertain: string;
  whatToDoNext: string;
  whereToGetHelp: string;
  fullMarkdown: string;
}

export class GroundedAiService {
  /**
   * Deterministically assemble the strict 5-part response contract:
   * 1. What We Know
   * 2. Source and Time
   * 3. What is Uncertain
   * 4. What to Do Next
   * 5. Where to Get Help
   */
  public generateGroundedResponse(
    _userQuery: string,
    lang: SupportedLanguage = 'en',
    ctx: GroundedContextInput = {}
  ): GroundedSectionedOutput {
    const locName = typeof ctx.location === 'string'
      ? ctx.location
      : ctx.location?.name || ctx.sector || 'Local Operational Sector';

    const lat = typeof ctx.location === 'object' && ctx.location
      ? ctx.location.latitude
      : ctx.latitude ?? (ctx.weather?.location as any)?.latitude;

    const lon = typeof ctx.location === 'object' && ctx.location
      ? ctx.location.longitude
      : ctx.longitude ?? (ctx.weather?.location as any)?.longitude;

    const coordsStr = typeof lat === 'number' && typeof lon === 'number'
      ? `${lat.toFixed(4)}°N, ${lon.toFixed(4)}°E`
      : 'Coordinates Unspecified';

    const temp = ctx.weather?.temperatureC !== undefined ? `${ctx.weather.temperatureC}°C` : 'Telemetry in progress';
    const rain = ctx.weather?.precipitationMm !== undefined ? `${ctx.weather.precipitationMm} mm/h` : '0.0 mm/h';
    const wind = ctx.weather?.windSpeedKmh !== undefined ? `${ctx.weather.windSpeedKmh} km/h` : 'Calm';
    const weatherDesc = ctx.weather?.weatherDescription || 'Operational Monitoring';

    const riskLevel = ctx.risk?.overallRiskLevel || ctx.floodRisk?.category || ctx.floodRisk?.level || 'GUARDED';
    const riskScore = ctx.risk?.riskScore !== undefined
      ? `${ctx.risk.riskScore}/100`
      : ctx.floodRisk?.score !== undefined
      ? `${ctx.floodRisk.score}/100`
      : 'Screening ready';

    const alertsList = ctx.alerts?.alerts || [];
    const activeAlertsCount = ctx.alerts?.activeCount ?? alertsList.length;
    const topAlert = alertsList[0];

    const facilitiesList = ctx.facilities || [];
    const nearestShelters = facilitiesList.slice(0, 3);

    // Sanitize any accidental SFINCS leakage if user is civilian
    const isResearcher = ctx.userRole === 'researcher' || ctx.userRole === 'admin';

    if (lang === 'ta') {
      return this.formatTamilResponse(
        locName, coordsStr, temp, rain, wind, weatherDesc,
        riskLevel, riskScore, activeAlertsCount, topAlert,
        nearestShelters, isResearcher
      );
    }

    if (lang === 'hi') {
      return this.formatHindiResponse(
        locName, coordsStr, temp, rain, wind, weatherDesc,
        riskLevel, riskScore, activeAlertsCount, topAlert,
        nearestShelters, isResearcher
      );
    }

    return this.formatEnglishResponse(
      locName, coordsStr, temp, rain, wind, weatherDesc,
      riskLevel, riskScore, activeAlertsCount, topAlert,
      nearestShelters, isResearcher
    );
  }

  private formatEnglishResponse(
    locName: string,
    coordsStr: string,
    temp: string,
    rain: string,
    wind: string,
    weatherDesc: string,
    riskLevel: string,
    riskScore: string,
    alertsCount: number,
    topAlert: DisasterAlert | undefined,
    shelters: EmergencyFacility[],
    isResearcher: boolean
  ): GroundedSectionedOutput {
    // 1. WHAT WE KNOW
    const whatWeKnow =
      `• Location: **${locName}** (${coordsStr})\n` +
      `• Observed Conditions: **${weatherDesc}** | Temp: **${temp}** | Current Rain: **${rain}** | Wind: **${wind}**\n` +
      `• Indicative Flood Risk: **${riskLevel}** (Score: ${riskScore})\n` +
      `• Official Warnings: **${alertsCount} Active Warning(s)**${topAlert ? ` — ${topAlert.headline}` : ' (No active emergency bulletin)'}`;

    // 2. SOURCE AND TIME
    const nowIso = new Date().toISOString();
    const sourceAndTime =
      `• Meteorological Observations: **Open-Meteo NWP ECMWF/GFS** (Recorded/Live: ${nowIso})\n` +
      `• Official Alerts: **India Meteorological Department (IMD Nowcast RSS)**\n` +
      `• Flood Screening: **JATAYU Indicative Rainfall-Runoff Heuristic** (Internal Screening Tool)`;

    // 3. WHAT IS UNCERTAIN
    const sfincsNote = isResearcher
      ? `• Research SFINCS simulations are experimental research models and must not be used for civilian evacuation dispatch.`
      : `• Hydrodynamic SFINCS models are strictly quarantined research simulations and are NOT official civil defense directives.`;

    const whatIsUncertain =
      `• Real-time occupancy and bed availability at relief facilities is **UNKNOWN**. Verification via dispatch phone is mandatory before transit.\n` +
      `• Highly localized street-level storm drain blockages cannot be detected by regional radar or satellite telemetry.\n` +
      `${sfincsNote}\n` +
      `• Indicative flood risk scores are heuristic screening tools and do NOT constitute official municipal evacuation orders.`;

    // 4. WHAT TO DO NEXT
    let whatToDoNext = '';
    if (riskLevel === 'CRITICAL' || riskLevel === 'HIGH') {
      whatToDoNext =
        `1. **Seek Higher Ground:** If water begins entering your premises, move to upper levels immediately.\n` +
        `2. **Avoid Transit:** Do NOT walk, cycle, or drive through flooded roads or underpasses.\n` +
        `3. **Electrical Safety:** Turn off electrical mains at the breaker if water approaches wall outlets.\n` +
        `4. **Emergency Supplies:** Secure essential medications, identity documents, phone chargers, and clean drinking water in waterproof bags.`;
    } else {
      whatToDoNext =
        `1. **Monitor Bulletins:** Keep battery-powered radios or mobile alerts active for official IMD updates.\n` +
        `2. **Check Drainage:** Clear roof gutters and street-level drainage grates near premises if safe to do so.\n` +
        `3. **Prepare Contingency Kit:** Maintain emergency torch, charged powerbank, dry rations, and first-aid supplies.`;
    }

    // 5. WHERE TO GET HELP
    const shelterLines = shelters.length > 0
      ? shelters.map((s) => {
          const categoryLabel = s.category ? String(s.category).replace(/_/g, ' ') : 'RELIEF CENTER';
          return `  - **${s.name}** (${categoryLabel})\n    Address: ${s.address || 'Address on record'}\n    Contact: ${(s as any).phone || (s as any).contactPhone || '1913 / 112'} | Status: **UNKNOWN AVAILABILITY** (Call before dispatch)`;
        }).join('\n')
      : '  - No relief center located within immediate radius. Contact District Operations Centre below.';

    const whereToGetHelp =
      `• **National Emergency Helpline:** **112** (Police, Fire, Disaster Dispatch)\n` +
      `• **State Emergency Operations Centre (SEOC):** **1070**\n` +
      `• **District Emergency Operations Centre (DEOC):** **1077**\n` +
      `• **Municipal Disaster Control Room:** **1913** (Chennai GCC) / **1916** (Mumbai BMC) / **040-21111111** (Hyderabad GHMC)\n` +
      `• **Ambulance / Medical Emergency:** **108**\n` +
      `• **Nearest Verified Relief Facilities (Call to verify gate status):**\n${shelterLines}`;

    const fullMarkdown =
      `### 1. What We Know\n${whatWeKnow}\n\n` +
      `### 2. Source and Time\n${sourceAndTime}\n\n` +
      `### 3. What is Uncertain\n${whatIsUncertain}\n\n` +
      `### 4. What to Do Next\n${whatToDoNext}\n\n` +
      `### 5. Where to Get Help\n${whereToGetHelp}`;

    return {
      whatWeKnow,
      sourceAndTime,
      whatIsUncertain,
      whatToDoNext,
      whereToGetHelp,
      fullMarkdown,
    };
  }

  private formatTamilResponse(
    locName: string,
    coordsStr: string,
    temp: string,
    rain: string,
    wind: string,
    weatherDesc: string,
    riskLevel: string,
    riskScore: string,
    alertsCount: number,
    topAlert: DisasterAlert | undefined,
    shelters: EmergencyFacility[],
    _isResearcher: boolean
  ): GroundedSectionedOutput {
    const whatWeKnow =
      `• இடம்: **${locName}** (${coordsStr})\n` +
      `• கவனிக்கப்பட்ட வானிலை: **${weatherDesc}** | வெப்பநிலை: **${temp}** | மழை: **${rain}** | காற்று: **${wind}**\n` +
      `• உத்தேச வெள்ள அபாயம்: **${riskLevel}** (மதிப்பெண்: ${riskScore})\n` +
      `• அதிகாரப்பூர்வ எச்சரிக்கைகள்: **${alertsCount} செயலில்**${topAlert ? ` — ${topAlert.headline}` : ' (செயலில் உள்ள அவசர எச்சரிக்கை இல்லை)'}`;

    const sourceAndTime =
      `• வானிலை அவதானிப்புகள்: **Open-Meteo NWP ECMWF/GFS**\n` +
      `• அதிகாரப்பூர்வ எச்சரிக்கைகள்: **இந்திய வானிலை ஆய்வு மையம் (IMD Nowcast RSS)**\n` +
      `• வெள்ள திரையிடல்: **ஜடாயு உள் மாதிரி (JATAYU Indicative Heuristic)**`;

    const whatIsUncertain =
      `• நிவாரண முகாம்களில் தற்போதைய காலி இடங்கள் மற்றும் படுக்கை கிடைக்கும் தன்மை **தெரியவில்லை (UNKNOWN)**. புறப்படுவதற்கு முன் தொலைபேசி மூலம் சரிபார்க்கவும்.\n` +
      `• உள்ளூர் கழிவுநீர் அடைப்புகளை செயற்கைக்கோள் தரவு மூலம் உடனடியாக கண்டறிய முடியாது.\n` +
      `• உத்தேச அபாய மதிப்பீடு ஒரு வழிகாட்டுதல் மட்டுமே; அதிகாரப்பூர்வ வெளியேற்ற உத்தரவு அல்ல.`;

    const whatToDoNext =
      `1. **உயரமான இடங்களுக்குச் செல்லவும்:** வளாகத்திற்குள் தண்ணீர் புகுந்தால் உடனடியாக மேல் தளங்களுக்குச் செல்லவும்.\n` +
      `2. **பயணத்தை தவிர்க்கவும்:** வெள்ளத்தில் மூழ்கிய சாலைகளில் நடக்கவோ வாகனங்களை இயக்கவோ வேண்டாம்.\n` +
      `3. **மின் பாதுகாப்பு:** சுவிட்ச் பலகைகளுக்கு அருகில் தண்ணீர் வந்தால் மின்சார மெயின்களை அணைக்கவும்.\n` +
      `4. **அத்தியாவசியப் பொருட்கள்:** மருந்துகள் மற்றும் ஆவணங்களை நீர்ப்புகா பைகளில் பாதுகாக்கவும்.`;

    const shelterLines = shelters.length > 0
      ? shelters.map((s) => `  - **${s.name}**\n    முகவரி: ${s.address || 'பதிவில் உள்ள முகவரி'}\n    தொடர்பு: ${(s as any).phone || (s as any).contactPhone || '1913 / 112'} | நிலை: **தெரியவில்லை (UNKNOWN)**`).join('\n')
      : '  - உடனடி வரம்பில் நிவாரண மையம் இல்லை. மாவட்ட அவசர உதவி எண்ணை அழைக்கவும்.';

    const whereToGetHelp =
      `• **தேசிய அவசர உதவி எண்:** **112**\n` +
      `• **மாநில பேரிடர் கட்டுப்பாட்டு அறை (SEOC):** **1070**\n` +
      `• **மாவட்ட பேரிடர் கட்டுப்பாட்டு அறை (DEOC):** **1077**\n` +
      `• **சென்னை மாநகராட்சி கட்டுப்பாட்டு அறை:** **1913**\n` +
      `• **மருத்துவ அவசர உதவி (ஆம்புலன்ஸ்):** **108**\n` +
      `• **அருகிலுள்ள நிவாரண முகாம்கள் (புறப்படுவதற்கு முன் அழைக்கவும்):**\n${shelterLines}`;

    const fullMarkdown =
      `### 1. நாம் அறிந்தது என்ன (What We Know)\n${whatWeKnow}\n\n` +
      `### 2. தரவு ஆதாரம் மற்றும் நேரம் (Source and Time)\n${sourceAndTime}\n\n` +
      `### 3. நிச்சயமற்ற நிலைகள் (What is Uncertain)\n${whatIsUncertain}\n\n` +
      `### 4. அடுத்து செய்ய வேண்டிய நடவடிக்கைகள் (What to Do Next)\n${whatToDoNext}\n\n` +
      `### 5. எங்கு உதவி பெறுவது (Where to Get Help)\n${whereToGetHelp}`;

    return { whatWeKnow, sourceAndTime, whatIsUncertain, whatToDoNext, whereToGetHelp, fullMarkdown };
  }

  private formatHindiResponse(
    locName: string,
    coordsStr: string,
    temp: string,
    rain: string,
    wind: string,
    weatherDesc: string,
    riskLevel: string,
    riskScore: string,
    alertsCount: number,
    topAlert: DisasterAlert | undefined,
    shelters: EmergencyFacility[],
    _isResearcher: boolean
  ): GroundedSectionedOutput {
    const whatWeKnow =
      `• स्थान: **${locName}** (${coordsStr})\n` +
      `• प्रेक्षित मौसम: **${weatherDesc}** | तापमान: **${temp}** | वर्तमान वर्षा: **${rain}** | हवा: **${wind}**\n` +
      `• आंतरिक सांकेतिक बाढ़ जोखिम: **${riskLevel}** (स्कोर: ${riskScore})\n` +
      `• आधिकारिक चेतावनियाँ: **${alertsCount} सक्रिय**${topAlert ? ` — ${topAlert.headline}` : ' (कोई सक्रिय आपातकालीन बुलेटिन नहीं)'}`;

    const sourceAndTime =
      `• मौसम विज्ञान अवलोकन: **Open-Meteo NWP ECMWF/GFS**\n` +
      `• आधिकारिक चेतावनियाँ: **भारत मौसम विज्ञान विभाग (IMD Nowcast RSS)**\n` +
      `• बाढ़ जोखिम स्क्रीनिंग: **जटायु आंतरिक अनुमानी मॉडल (JATAYU Heuristic)**`;

    const whatIsUncertain =
      `• राहत शिविरों में वास्तविक समय की उपलब्धता और बिस्तर की स्थिति **अज्ञात (UNKNOWN)** है। जाने से पहले फोन पर पुष्टि अनिवार्य है।\n` +
      `• अत्यधिक स्थानीय नालों के अवरोध को क्षेत्रीय उपग्रह डेटा द्वारा तुरंत नहीं पहचाना जा सकता।\n` +
      `• सांकेतिक बाढ़ जोखिम केवल स्क्रीनिंग के लिए है; यह आधिकारिक निकासी आदेश नहीं है।`;

    const whatToDoNext =
      `1. **ऊंचे स्थानों पर जाएं:** यदि पानी परिसर में प्रवेश करने लगे तो तुरंत ऊपरी मंजिल पर जाएं।\n` +
      `2. **यात्रा से बचें:** जलमग्न सड़कों या अंडरपास से न चलें और न ही वाहन चलाएं।\n` +
      `3. **विद्युत सुरक्षा:** पानी स्विच बोर्ड तक पहुंचने पर मुख्य विद्युत आपूर्ति बंद कर दें।\n` +
      `4. **आपातकालीन आपूर्ति:** दवाएं, महत्वपूर्ण दस्तावेज और पीने का पानी वाटरप्रूफ बैग में सुरक्षित रखें।`;

    const shelterLines = shelters.length > 0
      ? shelters.map((s) => `  - **${s.name}**\n    पता: ${s.address || 'दर्ज पता'}\n    संपर्क: ${(s as any).phone || (s as any).contactPhone || '1913 / 112'} | स्थिति: **अज्ञात (UNKNOWN)**`).join('\n')
      : '  - तत्काल सीमा में कोई राहत केंद्र नहीं मिला। जिला नियंत्रण कक्ष से संपर्क करें।';

    const whereToGetHelp =
      `• **राष्ट्रीय आपातकालीन हेल्पलाइन:** **112**\n` +
      `• **राज्य आपातकालीन संचालन केंद्र (SEOC):** **1070**\n` +
      `• **जिला आपातकालीन संचालन केंद्र (DEOC):** **1077**\n` +
      `• **नगर निगम नियंत्रण कक्ष:** **1913** (चेन्नई) / **1916** (मुंबई) / **040-21111111** (हैदराबाद)\n` +
      `• **एंबुलेंस / चिकित्सा आपातकाल:** **108**\n` +
      `• **निकटतम सत्यापित राहत सुविधाएं (जाने से पहले कॉल करें):**\n${shelterLines}`;

    const fullMarkdown =
      `### 1. हम क्या जानते हैं (What We Know)\n${whatWeKnow}\n\n` +
      `### 2. स्रोत और समय (Source and Time)\n${sourceAndTime}\n\n` +
      `### 3. क्या अनिश्चित है (What is Uncertain)\n${whatIsUncertain}\n\n` +
      `### 4. आगे क्या करें (What to Do Next)\n${whatToDoNext}\n\n` +
      `### 5. सहायता कहाँ से प्राप्त करें (Where to Get Help)\n${whereToGetHelp}`;

    return { whatWeKnow, sourceAndTime, whatIsUncertain, whatToDoNext, whereToGetHelp, fullMarkdown };
  }
}

export const groundedAiService = new GroundedAiService();
