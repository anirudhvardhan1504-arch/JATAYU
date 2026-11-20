import React from 'react';
import { WeatherWorkspace, WeatherWorkspaceProps } from '../components/WeatherWorkspace';

export interface HomePageProps extends WeatherWorkspaceProps {
  alertsLoading: boolean;
  alertsError: string | null;
}

export const HomePage: React.FC<HomePageProps> = (props) => <WeatherWorkspace {...props} />;
