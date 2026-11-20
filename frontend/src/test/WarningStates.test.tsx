import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { WeatherWorkspace } from '../components/WeatherWorkspace';
import { LanguageProvider } from '../context/LanguageContext';
import { AlertFeedResponse } from '../types';
vi.mock('../components/map/TacticalMap', () => ({ TacticalMap: () => null }));
const feed = (status: AlertFeedResponse['feedStatus']) => ({ fetchedAt:'2026-11-20T10:00:00Z',source:'IMD',feedStatus:status,itemCount:0,officialAlerts:[],nationwideAlerts:[],indicativeAlerts:[],demonstrationScenarios:[],limitations:[],disclaimer:'', geographicResolution:{coordinates:{latitude:17.385,longitude:78.4867},resolvedDistrict:'HYDERABAD',resolvedState:'TELANGANA',matchStatus:'RESOLVED_DISTRICT',datasetSource:'test fixture',vintage:'2011'} } as AlertFeedResponse);
const show = (status: AlertFeedResponse['feedStatus']) => render(<LanguageProvider defaultLanguage="en"><WeatherWorkspace location={{name:'Hyderabad',lat:17.385,lon:78.4867}} weather={null} forecast={null} alertFeed={feed(status)}/></LanguageProvider>);
describe('IMD warning states',()=>{
 it('treats a successfully fetched empty feed as checked',()=>{show('EMPTY');expect(screen.getByText('No Active IMD Warning Found')).toBeInTheDocument();expect(screen.queryByText('Warning Feed Temporarily Unavailable')).not.toBeInTheDocument();});
 it('labels cached data explicitly rather than claiming an outage or live all-clear',()=>{show('CACHED');expect(screen.getByText('Cached warning information')).toBeInTheDocument();expect(screen.queryByText('No Active IMD Warning Found')).not.toBeInTheDocument();});
 it('retains an unavailable warning when upstream verification fails',()=>{show('UPSTREAM_FALLBACK');expect(screen.getByText('Warning Feed Temporarily Unavailable')).toBeInTheDocument();});
});
