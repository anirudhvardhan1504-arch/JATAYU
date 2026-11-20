import { describe,it,expect,vi,beforeEach } from 'vitest';
import { render,screen,fireEvent } from '@testing-library/react';
import { AppShell } from '../components/layout/AppShell';
import { LanguageProvider } from '../context/LanguageContext';
import { AuthProvider } from '../context/AuthContext';
const show=()=>render(<LanguageProvider defaultLanguage="en"><AuthProvider><AppShell activeTab="home" onSelectTab={vi.fn()} selectedLocation={{name:'Hyderabad',lat:17.385,lon:78.4867}} onSelectLocation={vi.fn()}><p>Test content</p></AppShell></AuthProvider></LanguageProvider>);
beforeEach(()=>localStorage.clear());
describe('Light/dark preference and public globe entry',()=>{
 it('toggles appearance and persists the choice without changing weather state',()=>{
  const {container}=show();const shell=container.querySelector('.app-shell')!;const mood=shell.getAttribute('data-weather');
  fireEvent.click(screen.getByRole('button',{name:'Switch to dark mode'}));
  expect(shell).toHaveAttribute('data-theme','dark');expect(localStorage.getItem('jatayu-color-theme')).toBe('dark');expect(shell.getAttribute('data-weather')).toBe(mood);
  fireEvent.click(screen.getByRole('button',{name:'Switch to light mode'}));expect(shell).toHaveAttribute('data-theme','light');
 });
 it('restores a saved dark preference',()=>{localStorage.setItem('jatayu-color-theme','dark');show();expect(screen.getByRole('button',{name:'Switch to light mode'})).toBeInTheDocument();});
 it('shows the 3D globe entry without a researcher login',()=>{show();expect(screen.getByRole('button',{name:'3D Command Globe'})).toBeInTheDocument();});
});
