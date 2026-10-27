import {
  CurrentWeatherObservation,
  WeatherForecastResponse,
  IndicativeFloodRiskAssessment,
  AlertFeedResponse,
} from '../types';

export interface SitrepGeneratorOptions {
  location: { name: string; lat: number; lon: number };
  weather: CurrentWeatherObservation | null;
  forecast: WeatherForecastResponse | null;
  riskAssessment: IndicativeFloodRiskAssessment | null;
  alertFeed: AlertFeedResponse | null;
  alertsError?: string | null;
  weatherError?: string | null;
  language: 'en' | 'ta' | 'hi';
  user?: { displayName?: string; username?: string; role?: string } | null;
}

/**
 * Generates an unhallucinated, deterministic Tactical Situation Report (SITREP) in Markdown.
 * Operates offline or without external LLM keys.
 * Preserves strict Tier 1 / Tier 2 / Tier 3 provenance and safety disclaimers.
 */
export function generateTacticalSitrep(options: SitrepGeneratorOptions): string {
  const {
    location,
    weather,
    forecast,
    riskAssessment,
    alertFeed,
    alertsError,
    weatherError,
    language,
    user,
  } = options;

  const now = new Date();
  const isoTime = now.toISOString();
  const utcString = now.toUTCString().replace('GMT', 'UTC');
  const officerName = user?.displayName || user?.username || 'Field Operations Officer';
  const officerRole = user?.role || 'RESPONDER';
  const resolvedDistrict = alertFeed?.geographicResolution?.resolvedDistrict || null;

  const officialAlerts = alertFeed?.officialAlerts || [];
  const alertsCount = officialAlerts.length;

  if (language === 'ta') {
    return generateTamilSitrep({
      location,
      weather,
      forecast,
      riskAssessment,
      alertFeed,
      alertsError,
      weatherError,
      isoTime,
      utcString,
      officerName,
      officerRole,
      resolvedDistrict,
      officialAlerts,
      alertsCount,
    });
  }

  if (language === 'hi') {
    return generateHindiSitrep({
      location,
      weather,
      forecast,
      riskAssessment,
      alertFeed,
      alertsError,
      weatherError,
      isoTime,
      utcString,
      officerName,
      officerRole,
      resolvedDistrict,
      officialAlerts,
      alertsCount,
    });
  }

  // Default English (en)
  return generateEnglishSitrep({
    location,
    weather,
    forecast,
    riskAssessment,
    alertFeed,
    alertsError,
    weatherError,
    isoTime,
    utcString,
    officerName,
    officerRole,
    resolvedDistrict,
    officialAlerts,
    alertsCount,
  });
}

function formatFactors(factors: any): string {
  if (!factors) return '  • No specific risk factors identified';
  if (Array.isArray(factors)) {
    return factors
      .map((f: any) => `  • ${f.name || 'Factor'}: ${f.description || f.contribution || ''}`)
      .join('\n');
  }
  if (typeof factors === 'object') {
    return Object.entries(factors)
      .map(([k, v]: [string, any]) => {
        if (typeof v === 'object' && v !== null) {
          return `  • ${v.name || k}: ${v.description || v.contribution || v.value || JSON.stringify(v)}`;
        }
        return `  • ${k}: ${v}`;
      })
      .join('\n');
  }
  return `  • ${String(factors)}`;
}

function generateEnglishSitrep(ctx: any): string {
  const {
    location,
    weather,
    forecast,
    riskAssessment,
    alertFeed,
    alertsError,
    weatherError,
    isoTime,
    utcString,
    officerName,
    officerRole,
    resolvedDistrict,
    officialAlerts,
    alertsCount,
  } = ctx;

  // Alerts section
  let alertsContent = '';
  if (alertsError) {
    alertsContent = `⚠️ **OFFICIAL IMD ALERT FEED UNREACHABLE:** ${alertsError}\n*Field Protocol: Contact State Emergency Operations Centre (1070) or local District Collectorate directly.*`;
  } else if (!alertFeed) {
    alertsContent = `*Official alert feed standby / synchronizing...*`;
  } else if (alertsCount === 0) {
    alertsContent = `✅ **NO ACTIVE OFFICIAL WARNING BULLETINS ISSUED BY IMD FOR THIS DISTRICT.**\n*Monitoring continuous Nowcast RSS stream.*`;
  } else {
    alertsContent = officialAlerts
      .map(
        (a: any, i: number) =>
          `### ${i + 1}. [${a.severity || 'WARNING'}] ${a.title || 'Official Weather Bulletin'}\n` +
          `- **Issuing Agency:** ${a.source || 'IMD Nowcast RSS / CAP'}\n` +
          `- **Issued Timestamp:** ${a.timestamp || 'Recorded in feed'}\n` +
          `- **Details:** ${a.description || 'Monitor official public broadcast channels for updates.'}`
      )
      .join('\n\n');
  }

  // Weather section
  let weatherContent = '';
  if (weatherError || (!weather && !forecast)) {
    weatherContent = `⚠️ **METEOROLOGICAL TELEMETRY OFFLINE:** ${weatherError || 'Upstream observation unavailable'}\n*Safety Warning: Do NOT assume calm conditions when telemetry is offline.*`;
  } else if (weather) {
    const staleAdvisory = weather.isStale
      ? `\n⚠️ **STALE TELEMETRY ADVISORY:** Observation age exceeds 90 minutes. Telemetry latency detected.`
      : '';
    weatherContent =
      `- **Observation Status:** ${weather.isStale ? 'STALE (>90m)' : 'LIVE (OBSERVED)'}${staleAdvisory}\n` +
      `- **Observation Timestamp:** ${weather.timestamp || 'N/A'}\n` +
      `- **Telemetry Fetched At:** ${new Date(weather.fetchedAt).toISOString()}\n` +
      `- **Observed Temperature:** ${weather.temperatureC !== undefined ? `${weather.temperatureC}°C (Feels like: ${weather.apparentTemperatureC}°C)` : 'Sensor Offline'}\n` +
      `- **Precipitation Rate:** ${weather.precipitationMm !== undefined ? `${weather.precipitationMm} mm/h` : 'Sensor Offline'}\n` +
      `- **Wind Velocity:** ${weather.windSpeedKmh !== undefined ? `${weather.windSpeedKmh} km/h (Gusts: ${weather.windGustsKmh ?? 'N/A'} km/h)` : 'Sensor Offline'}\n` +
      `- **Root-Zone Soil Moisture (0-7cm):** ${weather.soilMoisture0To7cm !== undefined ? `${(weather.soilMoisture0To7cm * 100).toFixed(1)}%` : 'Sensor Offline'}\n` +
      `- **24-Hour Projected Rainfall:** ${forecast?.accumulations?.next24hRainfallMm !== undefined ? `${forecast.accumulations.next24hRainfallMm} mm` : 'Model Offline'}`;
  }

  // Risk section
  let riskContent = '';
  if (!riskAssessment) {
    riskContent = `*Indicative flood risk screening pending or calculating...*`;
  } else {
    const formattedFactors = formatFactors(riskAssessment.factors);
    riskContent =
      `- **Screening Category:** **${riskAssessment.overallRiskLevel || 'GUARDED'}**\n` +
      `- **Algorithmic Risk Score:** **${riskAssessment.riskScore !== undefined ? `${riskAssessment.riskScore}/100` : 'N/A'}**\n` +
      `- **Hydrological Factors:**\n` +
      formattedFactors +
      `\n- **Mandatory Caveat:** *INDICATIVE SCREENING MODEL ONLY. Calibrated on SCS-CN curve numbers and antecedent rainfall. Not an official civil defense evacuation order.*`;
  }

  return `# JATAYU TACTICAL SITUATION REPORT (SITREP)

**Document Reference:** JATAYU-SITREP-${isoTime.replace(/[:.]/g, '')}  
**Generated At:** ${isoTime} (${utcString})  
**Operations Officer:** ${officerName} (Role: ${officerRole})  
**Tactical Sector:** ${location.name}  
**Geospatial Fix:** ${location.lat.toFixed(4)}°N, ${location.lon.toFixed(4)}°E  
**Resolved District:** ${resolvedDistrict || 'Geographic Resolution Pending'}  

---

## 1. Official Multi-Agency Weather Warnings (Tier 1 Verified)
**Data Source:** India Meteorological Department (IMD Nowcast RSS)  
**Active Bulletins:** ${alertsCount}

${alertsContent}

---

## 2. Real-Time Meteorological Telemetry (Open-Meteo ECMWF/GFS Blend)
**Data Source:** Open-Meteo Audited Weather API (Physical NWP Model)

${weatherContent}

---

## 3. Indicative Flood Risk Screening (Tier 2 Heuristic Prototype)
**Model Attribution:** JATAYU Antecedent Saturation & Runoff Heuristic

${riskContent}

---

## 4. Emergency Communications & Tactical Helplines
- **State Emergency Operations Centre (SEOC):** 1070 (Toll-Free, 24/7)
- **District Disaster Management Authority (DDMA):** 1077 (Toll-Free)
- **National Emergency Response Support System (ERSS):** 112 (Police / Fire / Ambulance)
- **Municipal Corporation Disaster Control Cell:** 1913
- **Facility Admission Advisory:** *Emergency relief shelter and hospital bed vacancies are strictly UNKNOWN in telemetry. Incident commanders and field responders must confirm active capacity via telephone dispatch before directing evacuee convoys.*

---

## 5. Decision Support & Operational Integrity Disclaimer
*This Tactical Situation Report is synthesized automatically by JATAYU for operational decision support and situational awareness. It does not supersede or replace official statutory directives issued by the State Disaster Management Authority (TNSDMA/SDMA), National Disaster Management Authority (NDMA), or District Collectorate. Uncalibrated hydrodynamic simulations (SFINCS) are segregated under research protocols and excluded from operational conclusions.*
`;
}

function generateTamilSitrep(ctx: any): string {
  const {
    location,
    weather,
    forecast,
    riskAssessment,
    alertFeed,
    alertsError,
    weatherError,
    isoTime,
    utcString,
    officerName,
    officerRole,
    resolvedDistrict,
    officialAlerts,
    alertsCount,
  } = ctx;

  let alertsContent = '';
  if (alertsError) {
    alertsContent = `⚠️ **அதிகாரப்பூர்வ IMD எச்சரிக்கை ஊட்டம் கிடைக்கவில்லை:** ${alertsError}\n*கள நெறிமுறை: மாநில அவசரகால செயல்பாட்டு மையம் (1070) அல்லது மாவட்ட ஆட்சியர் அலுவலகத்தை நேரடியாக தொடர்பு கொள்ளவும்.*`;
  } else if (!alertFeed) {
    alertsContent = `*அதிகாரப்பூர்வ எச்சரிக்கை ஊட்டம் ஒத்திசைக்கப்படுகிறது...*`;
  } else if (alertsCount === 0) {
    alertsContent = `✅ **இந்த மாவட்டத்திற்கு IMD வழங்கிய செயலில் உள்ள எச்சரிக்கைகள் எதுவும் இல்லை.**\n*நிகழ்நேர Nowcast RSS ஊட்டம் தொடர்ந்து கண்காணிக்கப்படுகிறது.*`;
  } else {
    alertsContent = officialAlerts
      .map(
        (a: any, i: number) =>
          `### ${i + 1}. [${a.severity || 'எச்சரிக்கை'}] ${a.title || 'அதிகாரப்பூர்வ வானிலை அறிவிப்பு'}\n` +
          `- **வழங்கிய முகமை:** ${a.source || 'IMD Nowcast RSS'}\n` +
          `- **வெளியிடப்பட்ட நேரம்:** ${a.timestamp || 'ஊட்டத்தில் பதிவு செய்யப்பட்டுள்ளது'}\n` +
          `- **விவரங்கள்:** ${a.description || 'தகவல்களுக்கு அதிகாரப்பூர்வ ஊடகங்களை தொடர்ந்து கண்காணிக்கவும்.'}`
      )
      .join('\n\n');
  }

  let weatherContent = '';
  if (weatherError || (!weather && !forecast)) {
    weatherContent = `⚠️ **வானிலை தொலைத்தொடர்பு ஆஃப்லைன்:** ${weatherError || 'அவதானிப்பு கிடைக்கவில்லை'}\n*பாதுகாப்பு எச்சரிக்கை: தொலைத்தொடர்பு ஆஃப்லைனில் இருக்கும்போது அமைதியான சூழ்நிலையைக் கருத வேண்டாம்.*`;
  } else if (weather) {
    const staleAdvisory = weather.isStale
      ? `\n⚠️ **காலாவதியான தொலைத்தொடர்பு ஆலோசனை:** அவதானிப்பு தாமதம் 90 நிமிடங்களை தாண்டியுள்ளது.`
      : '';
    weatherContent =
      `- **அவதானிப்பு நிலை:** ${weather.isStale ? 'காலாவதியானது (>90m)' : 'நேரடி (கவனிக்கப்பட்டது)'}${staleAdvisory}\n` +
      `- **அவதானிப்பு முத்திரை:** ${weather.timestamp || 'இல்லை'}\n` +
      `- **கவனிக்கப்பட்ட வெப்பநிலை:** ${weather.temperatureC !== undefined ? `${weather.temperatureC}°C (உணரும் வெப்பநிலை: ${weather.apparentTemperatureC}°C)` : 'சென்சார் ஆஃப்லைன்'}\n` +
      `- **மழை வீதம்:** ${weather.precipitationMm !== undefined ? `${weather.precipitationMm} mm/h` : 'சென்சார் ஆஃப்லைன்'}\n` +
      `- **காற்று வேகம்:** ${weather.windSpeedKmh !== undefined ? `${weather.windSpeedKmh} km/h (காற்று வீச்சுகள்: ${weather.windGustsKmh ?? 'N/A'} km/h)` : 'சென்சார் ஆஃப்லைன்'}\n` +
      `- **மண் ஈரப்பதம் (0-7cm):** ${weather.soilMoisture0To7cm !== undefined ? `${(weather.soilMoisture0To7cm * 100).toFixed(1)}%` : 'சென்சார் ஆஃப்லைன்'}\n` +
      `- **அடுத்த 24 மணிநேர எதிர்பார்க்கப்படும் மழை:** ${forecast?.accumulations?.next24hRainfallMm !== undefined ? `${forecast.accumulations.next24hRainfallMm} mm` : 'மாதிரி ஆஃப்லைன்'}`;
  }

  let riskContent = '';
  if (!riskAssessment) {
    riskContent = `*வெள்ள அபாய திரையிடல் கணக்கிடப்படுகிறது...*`;
  } else {
    riskContent =
      `- **திரையிடல் வகை:** **${riskAssessment.overallRiskLevel || 'GUARDED'}**\n` +
      `- **ஹியூரிஸ்டிக் அபாய மதிப்பெண்:** **${riskAssessment.riskScore !== undefined ? `${riskAssessment.riskScore}/100` : 'N/A'}**\n` +
      `- **முக்கிய எச்சரிக்கை:** *வழிகாட்டுதல் திரையிடல் மாதிரி மட்டுமே. இது உத்தியோகபூர்வ வெளியேற்ற உத்தரவு அல்ல.*`;
  }

  return `# ஜடாயு செயல்பாட்டு சூழ்நிலை அறிக்கை (SITREP)

**ஆவணக் குறிப்பு:** JATAYU-SITREP-${isoTime.replace(/[:.]/g, '')}  
**உருவாக்கப்பட்ட நேரம்:** ${isoTime} (${utcString})  
**செயல்பாட்டு அதிகாரி:** ${officerName} (பொறுப்பு: ${officerRole})  
**களப் பகுதி:** ${location.name}  
**புவியியல் ஆயத்தொலைவுகள்:** ${location.lat.toFixed(4)}°N, ${location.lon.toFixed(4)}°E  
**தீர்மானிக்கப்பட்ட மாவட்டம்:** ${resolvedDistrict || 'மாவட்ட எல்லை நிலுவையில் உள்ளது'}  

---

## 1. அதிகாரப்பூர்வ வானிலை எச்சரிக்கைகள் (அடுக்கு 1 சரிபார்க்கப்பட்டது)
**தரவு மூலம்:** இந்திய வானிலை ஆய்வு மையம் (IMD Nowcast RSS)  
**செயலில் உள்ள அறிவிப்புகள்:** ${alertsCount}

${alertsContent}

---

## 2. நிகழ்நேர வானிலை தொலைத்தொடர்பு (Open-Meteo NWP மாதிரி)
**தரவு மூலம்:** Open-Meteo சரிபார்க்கப்பட்ட வானிலை API

${weatherContent}

---

## 3. உத்தேச வெள்ள அபாய திரையிடல் (அடுக்கு 2 ஹியூரிஸ்டிக் மாதிரி)
**மாதிரி பண்பு:** ஜடாயு முந்தைய செறிவு மற்றும் ஓட்ட ஹியூரிஸ்டிக்

${riskContent}

---

## 4. அவசர கால தொடர்புகள் & கட்டுப்பாட்டு எண்கள்
- **மாநில அவசரகால செயல்பாட்டு மையம் (SEOC):** 1070 (கட்டணமில்லா, 24/7)
- **மாவட்ட பேரிடர் மேலாண்மை ஆணையம் (DDMA):** 1077 (கட்டணமில்லா)
- **தேசிய அவசர உதவி எண் (ERSS):** 112 (காவல்துறை / தீயணைப்பு / ஆம்புலன்ஸ்)
- **மாநகராட்சி அவசர கட்டுப்பாட்டு அறை:** 1913
- **மையங்கள் கிடைக்கும் ஆலோசனை:** *நிவாரண முகாம்கள் மற்றும் மருத்துவமனை படுக்கை வசதிகள் strictly UNKNOWN என குறிக்கப்பட்டுள்ளன. பொதுமக்களை வழிநடத்துவதற்கு முன் தொலைபேசி மூலம் உறுதிப்படுத்தவும்.*

---

## 5. செயல்பாட்டு நேர்மை மற்றும் பொறுப்புதுறப்பு
*இந்த தந்திரோபாய சூழ்நிலை அறிக்கை முடிவெடுக்கும் ஆதரவிற்காக ஜடாயுவால் தானாக உருவாக்கப்பட்டது. இது TNSDMA, NDMA அல்லது மாவட்ட ஆட்சியரின் அதிகாரப்பூர்வ உத்தரவுகளை மாற்றாது. சரிபார்க்கப்படாத SFINCS மாதிரிகள் செயல்பாட்டு முடிவுகளிலிருந்து கண்டிப்பாக விலக்கப்பட்டுள்ளன.*
`;
}

function generateHindiSitrep(ctx: any): string {
  const {
    location,
    weather,
    forecast,
    riskAssessment,
    alertFeed,
    alertsError,
    weatherError,
    isoTime,
    utcString,
    officerName,
    officerRole,
    resolvedDistrict,
    officialAlerts,
    alertsCount,
  } = ctx;

  let alertsContent = '';
  if (alertsError) {
    alertsContent = `⚠️ **आधिकारिक IMD चेतावनी फ़ीड अनुपलब्ध:** ${alertsError}\n*फील्ड प्रोटोकॉल: राज्य आपातकालीन परिचालन केंद्र (1070) या स्थानीय जिला कलेक्ट्रेट से सीधे संपर्क करें।*`;
  } else if (!alertFeed) {
    alertsContent = `*आधिकारिक चेतावनी फ़ीड समन्वयन जारी है...*`;
  } else if (alertsCount === 0) {
    alertsContent = `✅ **इस जिले के लिए IMD द्वारा कोई सक्रिय चेतावनी जारी नहीं की गई है।**\n*नाउकास्ट RSS स्ट्रीम की निरंतर निगरानी जारी है।*`;
  } else {
    alertsContent = officialAlerts
      .map(
        (a: any, i: number) =>
          `### ${i + 1}. [${a.severity || 'चेतावनी'}] ${a.title || 'आधिकारिक मौसम बुलेटिन'}\n` +
          `- **जारीकर्ता एजेंसी:** ${a.source || 'IMD Nowcast RSS'}\n` +
          `- **जारी समय:** ${a.timestamp || 'फ़ीड में दर्ज'}\n` +
          `- **विवरण:** ${a.description || 'अद्यतन के लिए आधिकारिक प्रसारण चैनलों की निगरानी करें।'}`
      )
      .join('\n\n');
  }

  let weatherContent = '';
  if (weatherError || (!weather && !forecast)) {
    weatherContent = `⚠️ **मौसम संबंधी टेलीमेट्री ऑफ़लाइन:** ${weatherError || 'अवलोकन अनुपलब्ध'}\n*सुरक्षा चेतावनी: टेलीमेट्री ऑफ़लाइन होने पर शांत स्थिति का अनुमान न लगाएं।*`;
  } else if (weather) {
    const staleAdvisory = weather.isStale
      ? `\n⚠️ **पुरानी टेलीमेट्री परामर्श:** अवलोकन विलंबता 90 मिनट से अधिक है।`
      : '';
    weatherContent =
      `- **अवलोकन स्थिति:** ${weather.isStale ? 'पुरानी (>90m)' : 'लाइव (प्रेक्षित)'}${staleAdvisory}\n` +
      `- **अवलोकन समय:** ${weather.timestamp || 'N/A'}\n` +
      `- **प्रेक्षित तापमान:** ${weather.temperatureC !== undefined ? `${weather.temperatureC}°C (महसूस: ${weather.apparentTemperatureC}°C)` : 'सेंसर ऑफ़लाइन'}\n` +
      `- **वर्षा दर:** ${weather.precipitationMm !== undefined ? `${weather.precipitationMm} mm/h` : 'सेंसर ऑफ़लाइन'}\n` +
      `- **हवा की गति:** ${weather.windSpeedKmh !== undefined ? `${weather.windSpeedKmh} km/h (झोंके: ${weather.windGustsKmh ?? 'N/A'} km/h)` : 'सेंसर ऑफ़लाइन'}\n` +
      `- **मिट्टी की नमी (0-7cm):** ${weather.soilMoisture0To7cm !== undefined ? `${(weather.soilMoisture0To7cm * 100).toFixed(1)}%` : 'सेंसर ऑफ़लाइन'}\n` +
      `- **24 घंटे की अनुमानित वर्षा:** ${forecast?.accumulations?.next24hRainfallMm !== undefined ? `${forecast.accumulations.next24hRainfallMm} mm` : 'मॉडल ऑफ़लाइन'}`;
  }

  let riskContent = '';
  if (!riskAssessment) {
    riskContent = `*बाढ़ जोखिम स्क्रीनिंग की गणना की जा रही है...*`;
  } else {
    riskContent =
      `- **स्क्रीनिंग श्रेणी:** **${riskAssessment.overallRiskLevel || 'GUARDED'}**\n` +
      `- **अनुमानी जोखिम स्कोर:** **${riskAssessment.riskScore !== undefined ? `${riskAssessment.riskScore}/100` : 'N/A'}**\n` +
      `- **अनिवार्य चेतावनी:** *केवल सांकेतिक स्क्रीनिंग मॉडल। यह आधिकारिक नागरिक सुरक्षा निकासी आदेश नहीं है।*`;
  }

  return `# जटायु रणनीतिक स्थिति रिपोर्ट (SITREP)

**दस्तावेज़ संदर्भ:** JATAYU-SITREP-${isoTime.replace(/[:.]/g, '')}  
**जारी समय:** ${isoTime} (${utcString})  
**परिचालन अधिकारी:** ${officerName} (भूमिका: ${officerRole})  
**रणनीतिक क्षेत्र:** ${location.name}  
**भौगोलिक निर्देशांक:** ${location.lat.toFixed(4)}°N, ${location.lon.toFixed(4)}°E  
**समाधानित जिला:** ${resolvedDistrict || 'जिला सीमा लंबित'}  

---

## 1. आधिकारिक मौसम चेतावनियाँ (स्तर 1 सत्यापित)
**डेटा स्रोत:** भारत मौसम विज्ञान विभाग (IMD Nowcast RSS)  
**सक्रिय बुलेटिन:** ${alertsCount}

${alertsContent}

---

## 2. वास्तविक समय मौसम संबंधी टेलीमेट्री (Open-Meteo NWP मॉडल)
**डेटा स्रोत:** Open-Meteo सत्यापित मौसम API

${weatherContent}

---

## 3. सांकेतिक बाढ़ जोखिम स्क्रीनिंग (स्तर 2 अनुमानी मॉडल)
**मॉडल श्रेय:** जटायु पूर्व संतृप्ति एवं अपवाह अनुमान

${riskContent}

---

## 4. आपातकालीन संचार एवं हेल्पलाइन
- **राज्य आपातकालीन परिचालन केंद्र (SEOC):** 1070 (टोल-फ्री, 24/7)
- **जिला आपदा प्रबंधन प्राधिकरण (DDMA):** 1077 (टोल-फ्री)
- **राष्ट्रीय आपातकालीन प्रतिक्रिया प्रणाली (ERSS):** 112 (पुलिस / अग्निशमन / एम्बुलेंस)
- **नगर निगम आपदा नियंत्रण कक्ष:** 1913
- **सुविधा प्रवेश परामर्श:** *राहत शिविरों और अस्पताल के बिस्तरों की उपलब्धता strictly UNKNOWN है। नागरिकों को भेजने से पहले टेलीफोन द्वारा पुष्टि आवश्यक है।*

---

## 5. निर्णय समर्थन एवं परिचालन सत्यनिष्ठा अस्वीकरण
*यह रणनीतिक स्थिति रिपोर्ट परिचालन निर्णय समर्थन के लिए जटायु द्वारा स्वचालित रूप से तैयार की गई है। यह TNSDMA, NDMA या जिला कलेक्ट्रेट के आधिकारिक निर्देशों को प्रतिस्थापित नहीं करती है। असत्यापित SFINCS मॉडल परिचालन निष्कर्षों से कड़ाई से बाहर रखे गए हैं।*
`;
}
