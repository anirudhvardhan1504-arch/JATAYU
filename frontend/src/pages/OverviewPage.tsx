import React, { useContext, useMemo, useState } from 'react';
import { FileText } from 'lucide-react';
import { WeatherWorkspace, WeatherWorkspaceProps } from '../components/WeatherWorkspace';
import { AuthContext } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { generateTacticalSitrep } from '../utils/sitrepGenerator';
import { SitrepExportModal } from '../components/sitrep/SitrepExportModal';

interface OverviewPageProps extends WeatherWorkspaceProps { isLoading: boolean; }

export const OverviewPage: React.FC<OverviewPageProps> = (props) => {
  const auth = useContext(AuthContext);
  const { t, language } = useLanguage();
  const [exportOpen, setExportOpen] = useState(false);
  const report = useMemo(() => generateTacticalSitrep({
    location: props.location, weather: props.weather, forecast: props.forecast,
    riskAssessment: props.riskAssessment || null, alertFeed: props.alertFeed || null,
    alertsError: props.alertsError, weatherError: props.error, language, user: auth?.user || null,
  }), [props.location, props.weather, props.forecast, props.riskAssessment, props.alertFeed, props.alertsError, props.error, language, auth?.user]);
  return <>
    <WeatherWorkspace {...props} operational headerAction={<button className="workspace-button" onClick={() => setExportOpen(true)}><FileText size={15} />{t('sitrep.exportBtn')}</button>} />
    <SitrepExportModal isOpen={exportOpen} onClose={() => setExportOpen(false)} sitrepMarkdown={report} locationName={props.location.name} />
  </>;
};
