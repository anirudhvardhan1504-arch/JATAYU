import React, { useState } from 'react';
import {
  ShieldAlert,
  AlertTriangle,
  CheckCircle2,
  PhoneCall,
  Package,
  XCircle,
  ArrowRight,
  Info,
  Building2,
  Languages,
} from 'lucide-react';
import { EmergencyFacility } from '../../types';
import { useLanguage } from '../../context/LanguageContext';

export interface EvacuationInstructionsPanelProps {
  locality: string;
  disasterType?: 'FLOOD' | 'CYCLONE' | 'HEAVY_RAINFALL';
  severity?: 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL';
  nearbyFacilities?: EmergencyFacility[];
  hasOfficialEvacuationOrder?: boolean;
  officialOrderSource?: string;
  className?: string;
}

interface InstructionContent {
  precautions: string[];
  essentialItems: string[];
  actionsToAvoid: string[];
  helplines: { label: string; number: string }[];
  nextSteps: string[];
}

const INSTRUCTIONS_BY_LANG: Record<'en' | 'hi' | 'ta', InstructionContent> = {
  en: {
    precautions: [
      'Switch off main electricity breakers and LPG gas cylinders before leaving your premises.',
      'Move to higher ground or upper floors immediately if ground-level water begins pooling.',
      'Keep mobile devices charged and switch to battery-saver mode.',
      'Anchor loose outdoor objects and move valuable electronics above expected flood levels.',
    ],
    essentialItems: [
      'Drinking water (at least 3 litres per person) and non-perishable ready-to-eat dry food.',
      'Essential prescription medicines for at least 7 days and basic first-aid supplies.',
      'Waterproof document pouch with Aadhaar, ID cards, insurance, and medical records.',
      'High-intensity LED flashlight, extra dry batteries, and fully charged power banks.',
      'Sturdy footwear, lightweight waterproof jacket, and emergency distress whistle.',
    ],
    actionsToAvoid: [
      'DO NOT walk, wade, or drive through moving floodwaters (15cm can knock an adult down; 30cm floats most passenger cars).',
      'DO NOT approach downed power lines, submerged electrical junction boxes, or transformers.',
      'DO NOT cross submerged bridges, causeways, or low-lying river canal bends.',
      'DO NOT drink tap or flood water without boiling; avoid consuming exposed or contaminated food.',
      'DO NOT forward unverified disaster rumours on social messaging groups.',
    ],
    helplines: [
      { label: 'National All-Emergency Unified Response', number: '112' },
      { label: 'Medical Emergency & Disaster Ambulance', number: '108' },
      { label: 'State Emergency Operations Centre (SEOC)', number: '1070' },
      { label: 'District Disaster Emergency Cell (DEOC)', number: '1077' },
      { label: 'Municipal Flood & Waterlogging Control', number: '1913' },
      { label: 'National Disaster Response Force (NDRF)', number: '1078' },
    ],
    nextSteps: [
      'Verify designated evacuation shelters before departing; note that on-site capacity requires on-arrival confirmation.',
      'Depart via designated elevated arterial corridors; avoid low-lying chokepoints and drainage culverts.',
      'Assist elderly neighbors, children, and persons with mobility constraints during transit.',
      'Register with municipal relief wardens immediately upon arriving at the relief center.',
    ],
  },
  hi: {
    precautions: [
      'घर से निकलने से पहले मुख्य बिजली मीटर और एलपीजी गैस सिलेंडर का रेगुलेटर बंद कर दें।',
      'यदि निचले तल पर पानी भरने लगे तो तुरंत ऊपरी मंजिल या ऊंचे स्थान पर चले जाएं।',
      'मोबाइल फोन चार्ज रखें और बैटरी सेवर मोड चालू रखें।',
      'बाहर रखी हल्की वस्तुओं को बांध दें और जरूरी इलेक्ट्रॉनिक्स को पानी के स्तर से ऊपर रखें।',
    ],
    essentialItems: [
      'पीने का साफ पानी (प्रति व्यक्ति कम से कम 3 लीटर) और सूखा तैयार भोजन।',
      'कम से कम 7 दिनों की आवश्यक दवाइयाँ और प्राथमिक चिकित्सा किट।',
      'आधार कार्ड, बीमा और जरूरी कागजात वाटरप्रूफ प्लास्टिक थैली में रखें।',
      'एलईडी टॉर्च, अतिरिक्त सेल और पूरी तरह चार्ज पावर बैंक।',
      'मजबूत जूते, वाटरप्रूफ जैकेट और आपातकालीन सीटी (विपत्ति संकेत हेतु)।',
    ],
    actionsToAvoid: [
      'बहते बाढ़ के पानी में पैदल या वाहन से न जाएं (15 सेमी पानी इंसान को और 30 सेमी कार को बहा सकता है)।',
      'टूटे हुए बिजली के तारों, खंभों या डूबे ट्रांसफार्मर के पास कभी न जाएं।',
      'जलमग्न पुलों, कॉजवे या नदी के घुमावों को पार करने का प्रयास न करें।',
      'बाढ़ प्रभावित पानी को बिना उबाले न पिएं और खुले खाद्य पदार्थों का सेवन न करें।',
      'सोशल मीडिया पर बिना सत्यापन के अफवाहें न फैलाएं।',
    ],
    helplines: [
      { label: 'राष्ट्रीय आपातकालीन एकीकृत सेवा', number: '112' },
      { label: 'आपदा एवं चिकित्सा एम्बुलेंस सेवा', number: '108' },
      { label: 'राज्य आपदा नियंत्रण कक्ष (SEOC)', number: '1070' },
      { label: 'जिला आपदा नियंत्रण कक्ष (DEOC)', number: '1077' },
      { label: 'नगर निगम बाढ़ नियंत्रण प्रकोष्ठ', number: '1913' },
      { label: 'राष्ट्रीय आपदा प्रतिक्रिया बल (NDRF)', number: '1078' },
    ],
    nextSteps: [
      'रवाना होने से पहले निकटतम आश्रय केंद्र की पुष्टि करें; आगमन पर जगह की पुष्टि आवश्यक है।',
      'ऊंचे रास्तों का उपयोग करें; जलमग्न अंडरपास और नालों वाले रास्तों से बचें।',
      'बुजुर्गों, बच्चों और दिव्यांगजनों को निकासी में प्राथमिकता से सहायता दें।',
      'आश्रय केंद्र पहुँचने पर तुरंत राहत अधिकारियों के पास अपना नाम दर्ज कराएं।',
    ],
  },
  ta: {
    precautions: [
      'வெளியேறும் முன் பிரதான மின் சுவிட்ச் மற்றும் எல்பிஜி கேஸ் சிலிண்டர்களை அணைக்கவும்.',
      'தரைத்தளத்தில் தண்ணீர் தேங்கத் தொடங்கினால் உடனடியாக மேடான பகுதி அல்லது மேல் தளத்திற்குச் செல்லவும்.',
      'மொபைல் போன்களை முழுமையாக சார்ஜ் செய்து பேட்டரி சேவர் பயன்முறையில் வைக்கவும்.',
      'வெளியில் உள்ள பொருட்களைப் பாதுகாப்பாக கட்டி வைக்கவும்; மின்னணு சாதனங்களை உயரமான இடங்களில் வைக்கவும்.',
    ],
    essentialItems: [
      'குடிநீர் (நபருக்கு 3 லிட்டர்) மற்றும் கெடாத உலர் உணவுப் பொருட்கள்.',
      'குறைந்தது 7 நாட்களுக்கான அத்தியாவசிய மருந்துகள் மற்றும் முதலுதவி பெட்டி.',
      'ஆதார், ரேஷன் அட்டை, சொத்து ஆவணங்கள் கொண்ட நீர்ப்புகா பை.',
      'டார்ச் லைட், கூடுதல் பேட்டரிகள் மற்றும் முழுமையாக சார்ஜ் செய்யப்பட்ட பவர் பேங்க்.',
      'உறுதியான காலணிகள், மழை அங்கி மற்றும் அவசர சிக்னல் விபத்து விசில்.',
    ],
    actionsToAvoid: [
      'பாயும் வெள்ள நீரில் நடக்கவோ வாகனம் ஓட்டவோ வேண்டாம் (15 செ.மீ நீர் ஒருவரை தள்ளக்கூடும்; 30 செ.மீ காரை இழுத்துச் செல்லும்).',
      'அறுந்து விழுந்த மின்கம்பிகள் அல்லது நீரில் மூழ்கிய மின்பெட்டிகளை அணுக வேண்டாம்.',
      'வெள்ளத்தில் மூழ்கிய பாலங்கள், தரைப்பாலங்கள் அல்லது ஆற்றுப் படுகைகளைக் கடக்க வேண்டாம்.',
      'கொதிக்க வைக்காத நீரைக் குடிக்கவோ அசுத்தமான உணவை உட்கொள்ளவோ வேண்டாம்.',
      'சமூக ஊடகங்களில் உறுதிப்படுத்தப்படாத வதந்திகளைப் பகிர வேண்டாம்.',
    ],
    helplines: [
      { label: 'தேசிய ஒருங்கிணைந்த அவசர எண்', number: '112' },
      { label: 'மருத்துவ மற்றும் ஆம்புலன்ஸ் சேவை', number: '108' },
      { label: 'மாநில அவசர கால கட்டுப்பாட்டு மையம் (SEOC)', number: '1070' },
      { label: 'மாவட்ட அவசர கால கட்டுப்பாட்டு மையம் (DEOC)', number: '1077' },
      { label: 'மாநகராட்சி வெள்ளக் கட்டுப்பாட்டு அறை', number: '1913' },
      { label: 'தேசிய பேரிடர் மீட்புப் படை (NDRF)', number: '1078' },
    ],
    nextSteps: [
      'புறப்படுவதற்கு முன் அருகிலுள்ள நிவாரண முகாமை சரிபார்க்கவும்; நேரடி இடவசதி உறுதிப்படுத்தப்பட வேண்டும்.',
      'உயரமான முதன்மை சாலைகள் வழியே செல்லவும்; பள்ளமான சுரங்கப்பாதைகளைத் தவிர்க்கவும்.',
      'முதியவர்கள், குழந்தைகள் மற்றும் மாற்றுத்திறனாளிகளுக்கு முன்னுரிமை அளித்து உதவவும்.',
      'நிவாரண முகாமை அடைந்தவுடன் உடனடியாக அதிகாரிகளிடம் பதிவு செய்யவும்.',
    ],
  },
};

export const EvacuationInstructionsPanel: React.FC<EvacuationInstructionsPanelProps> = ({
  locality,
  disasterType = 'FLOOD',
  severity = 'HIGH',
  nearbyFacilities = [],
  hasOfficialEvacuationOrder = false,
  officialOrderSource = 'National Disaster Management Authority (NDMA)',
  className = '',
}) => {
  const { language: contextLang } = useLanguage();
  const [activeLang, setActiveLang] = useState<'en' | 'hi' | 'ta'>(
    contextLang === 'ta' || contextLang === 'hi' ? contextLang : 'en'
  );

  const content = INSTRUCTIONS_BY_LANG[activeLang] || INSTRUCTIONS_BY_LANG.en;
  const verifiedShelters = nearbyFacilities.filter(
    (f) =>
      f.category === 'SHELTER' ||
      f.category === 'RELIEF_CAMP' ||
      f.category === 'GOVT_SCHOOL_SHELTER'
  );

  return (
    <div className={`bg-navy-900 border border-navy-800 rounded-xl overflow-hidden shadow-lg ${className}`}>
      {/* Header Banner */}
      <div className={`p-4 border-b ${
        hasOfficialEvacuationOrder
          ? 'bg-red-950/80 border-red-800 text-red-200'
          : severity === 'CRITICAL' || severity === 'HIGH'
          ? 'bg-amber-950/70 border-amber-800/80 text-amber-200'
          : 'bg-navy-950 border-navy-800 text-slate-200'
      }`}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className={`p-2 rounded-lg ${hasOfficialEvacuationOrder ? 'bg-red-900/80 text-white animate-pulse' : 'bg-navy-800 text-amber-400'}`}>
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-black/40 border border-white/10">
                  {disasterType} • SEVERITY: {severity}
                </span>
                {hasOfficialEvacuationOrder && (
                  <span className="text-[10px] font-mono font-extrabold uppercase px-2 py-0.5 rounded bg-red-600 text-white animate-pulse">
                    OFFICIAL CIVIL DEFENSE ORDER
                  </span>
                )}
              </div>
              <h3 className="text-base font-bold text-white mt-1">
                Intelligent Evacuation Guidance & Protocol: {locality}
              </h3>
              <p className="text-xs text-slate-300 font-sans mt-0.5">
                {hasOfficialEvacuationOrder
                  ? `Official evacuation order issued by ${officialOrderSource}. Immediate civil compliance mandatory.`
                  : 'Decision-support preparedness guidance calibrated to local geographic hazards. Official government orders always supersede advisory guidance.'}
              </p>
            </div>
          </div>

          {/* Language Selector Pill */}
          <div className="flex items-center bg-navy-950 border border-navy-700 rounded-lg p-0.5 text-xs font-mono self-start sm:self-center">
            <Languages className="w-3.5 h-3.5 text-slate-400 ml-2 mr-1" />
            {(['en', 'hi', 'ta'] as const).map((lang) => (
              <button
                key={lang}
                onClick={() => setActiveLang(lang)}
                className={`px-2 py-1 rounded transition-colors uppercase cursor-pointer ${
                  activeLang === lang
                    ? 'bg-sky-600 text-white font-bold'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {lang === 'en' ? 'EN' : lang === 'hi' ? 'हिन्दी' : 'தமிழ்'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Grid: 4 Critical Pillars */}
      <div className="p-4 space-y-4">
        {/* Nearby Verified Shelters Recommendation Card */}
        {verifiedShelters.length > 0 && (
          <div className="p-3 bg-navy-950/70 border border-sky-800/60 rounded-lg space-y-2">
            <div className="flex items-center justify-between text-xs font-mono text-sky-400 font-bold uppercase tracking-wider">
              <span className="flex items-center gap-1.5">
                <Building2 className="w-4 h-4 text-sky-400" />
                Verified Destination Shelters In Range
              </span>
              <span className="text-[10px] text-amber-300 italic font-sans">
                Real-time vacancy is UNKNOWN — Call before dispatch
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {verifiedShelters.slice(0, 3).map((shelter) => (
                <div
                  key={shelter.id}
                  className="p-2.5 bg-navy-900 border border-navy-800 rounded text-xs space-y-1 hover:border-sky-600 transition-colors"
                >
                  <div className="font-bold text-white truncate">Shelter: {shelter.name}</div>
                  <div className="text-[11px] text-slate-400 truncate">{shelter.address}</div>
                  <div className="flex items-center justify-between pt-1 text-[10px] font-mono">
                    <span className="text-emerald-400 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" />
                      {shelter.verificationStatus === 'OFFICIALLY_VERIFIED' ? 'VERIFIED' : 'COMMUNITY'}
                    </span>
                    {shelter.distanceKm !== undefined && (
                      <span className="text-sky-300 font-bold">{shelter.distanceKm} km</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* 1. Immediate Precautions */}
          <div className="bg-navy-950/60 border border-navy-800 rounded-lg p-3.5 space-y-2">
            <div className="flex items-center gap-2 text-xs font-mono font-bold uppercase text-amber-400">
              <AlertTriangle className="w-4 h-4 text-amber-400" />
              <span>Immediate Precautions</span>
            </div>
            <ul className="space-y-1.5 text-xs text-slate-300">
              {content.precautions.map((item, idx) => (
                <li key={idx} className="flex items-start gap-2">
                  <span className="font-bold text-amber-400 font-mono text-[11px]">[{idx + 1}]</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* 2. Essential Items to Carry */}
          <div className="bg-navy-950/60 border border-navy-800 rounded-lg p-3.5 space-y-2">
            <div className="flex items-center gap-2 text-xs font-mono font-bold uppercase text-sky-400">
              <Package className="w-4 h-4 text-sky-400" />
              <span>Essential Evacuation Kit</span>
            </div>
            <ul className="space-y-1.5 text-xs text-slate-300">
              {content.essentialItems.map((item, idx) => (
                <li key={idx} className="flex items-start gap-2">
                  <span className="font-bold text-sky-400 font-mono text-[11px]">•</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* 3. Actions to Avoid */}
          <div className="bg-navy-950/60 border border-navy-800 rounded-lg p-3.5 space-y-2">
            <div className="flex items-center gap-2 text-xs font-mono font-bold uppercase text-red-400">
              <XCircle className="w-4 h-4 text-red-400" />
              <span>Critical Actions to Avoid</span>
            </div>
            <ul className="space-y-1.5 text-xs text-slate-300">
              {content.actionsToAvoid.map((item, idx) => (
                <li key={idx} className="flex items-start gap-2">
                  <span className="font-bold text-red-400 font-mono text-[11px]">✕</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* 4. Recommended Next Steps & Transit */}
          <div className="bg-navy-950/60 border border-navy-800 rounded-lg p-3.5 space-y-2">
            <div className="flex items-center gap-2 text-xs font-mono font-bold uppercase text-emerald-400">
              <ArrowRight className="w-4 h-4 text-emerald-400" />
              <span>Recommended Next Steps</span>
            </div>
            <ul className="space-y-1.5 text-xs text-slate-300">
              {content.nextSteps.map((item, idx) => (
                <li key={idx} className="flex items-start gap-2">
                  <span className="font-bold text-emerald-400 font-mono text-[11px]">→</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Emergency Helplines Rapid Access Bar */}
        <div className="bg-navy-950 border border-navy-800 p-3 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs font-mono">
          <div className="flex items-center gap-2 text-amber-400 font-bold">
            <PhoneCall className="w-4 h-4 text-amber-400" />
            <span>EMERGENCY HELPLINES:</span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {content.helplines.map((line, idx) => (
              <a
                key={idx}
                href={`tel:${line.number}`}
                className="px-2 py-1 rounded bg-navy-900 hover:bg-navy-800 border border-navy-700 text-slate-200 transition-colors flex items-center gap-1.5"
                title={line.label}
              >
                <span className="font-bold text-sky-400">{line.number}</span>
                <span className="text-[10px] text-slate-400 font-sans">({line.label.split(' ')[0]})</span>
              </a>
            ))}
          </div>
        </div>

        {/* Legal & Operational Mandate Notice */}
        <div className="p-3 bg-navy-950 border border-navy-800 rounded-lg text-[10px] text-slate-400 flex items-start gap-2 font-mono">
          <Info className="w-4 h-4 text-slate-500 flex-shrink-0 mt-0.5" />
          <p className="leading-relaxed font-sans">
            <strong>Statutory Mandate:</strong> JATAYU Evacuation Guidance synthesizes live atmospheric forecasts, historical river inundation pinch-points, and verified civil infrastructure. This service does not replace official civil defense orders. Follow local District Magistrate / Police barricades and public address directives at all times.
          </p>
        </div>
      </div>
    </div>
  );
};
