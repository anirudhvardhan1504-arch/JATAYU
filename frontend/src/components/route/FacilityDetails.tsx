import React from 'react';
import { EmergencyFacility } from '../../types';
import { useLanguage } from '../../context/LanguageContext';

/** Shared provenance treatment for the public directory and SafeRoute cards. */
export const FacilityDetails: React.FC<{ facility: EmergencyFacility }> = ({ facility }) => {
  const { language } = useLanguage();
  const copy = {
    te: { source: 'జాబితా ఆధారం', reviewed: 'ఆధారం పరిశీలించిన తేదీ', outside: 'ఎంచుకున్న పరిధి వెలుపల', confirm: 'సేవలు మరియు సరైన ప్రవేశద్వారం గురించి ఫోన్ చేసి నిర్ధారించండి.', directory: 'వైద్య కేంద్రాల జాబితా', community: 'సమాజ సమాచారం — నిర్ధారించబడలేదు' },
    en: { source: 'Directory source', reviewed: 'Source reviewed', outside: 'Outside selected radius', confirm: 'Call to confirm services and the correct entrance.', directory: 'Directory listing', community: 'Community mapped — unverified' },
    ta: { source: 'பட்டியல் ஆதாரம்', reviewed: 'ஆதாரம் சரிபார்த்த நாள்', outside: 'தேர்ந்தெடுத்த எல்லைக்கு வெளியே', confirm: 'சேவைகள் மற்றும் நுழைவாயிலை தொலைபேசியில் உறுதிப்படுத்தவும்.', directory: 'மருத்துவமனைப் பட்டியல்', community: 'சமூகத் தகவல் — சரிபார்க்கப்படவில்லை' },
    hi: { source: 'निर्देशिका स्रोत', reviewed: 'स्रोत जाँच की तारीख', outside: 'चयनित दायरे से बाहर', confirm: 'सेवाओं और सही प्रवेश द्वार की फ़ोन पर पुष्टि करें।', directory: 'निर्देशिका प्रविष्टि', community: 'सामुदायिक जानकारी — अपुष्ट' },
  }[language];
  return (
    <div className="space-y-1.5 text-xs leading-relaxed text-jatayu-secondary">
      {facility.outsideSearchRadius && <p role="note" className="font-semibold text-amber-300">{copy.outside}</p>}
      {facility.capabilities?.length ? <p>{facility.capabilities.join(' · ')}</p> : null}
      {facility.sourceUrl && <a href={facility.sourceUrl} target="_blank" rel="noopener noreferrer"
        className="inline-flex min-h-[44px] items-center text-jatayu-link underline underline-offset-4">{copy.source}</a>}
      {facility.sourceReviewedAt && <p>{copy.reviewed}: {facility.sourceReviewedAt}</p>}
      <p>{copy.confirm}</p>
    </div>
  );
};
