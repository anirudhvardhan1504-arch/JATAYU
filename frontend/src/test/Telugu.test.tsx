import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { LanguageProvider, useLanguage } from '../context/LanguageContext';
import { LanguageSelector } from '../components/common/LanguageSelector';
import { translations } from '../i18n/translations';
import { teluguTranslations } from '../i18n/telugu';
function Probe(){const {t}=useLanguage();return <p>{t('ai.subtitle',{location:'Hyderabad'})}</p>;}
describe('Telugu interface',()=>{
 it('has every public translation key and preserves interpolation tokens',()=>{
  expect(Object.keys(teluguTranslations).sort()).toEqual(Object.keys(translations.en).sort());
  for(const key of Object.keys(translations.en) as (keyof typeof translations.en)[]){
   const tokens=(text:string)=>[...text.matchAll(/\{(\w+)\}/g)].map(m=>m[1]).sort();
   expect(tokens(teluguTranslations[key]),key).toEqual(tokens(translations.en[key]));
  }
 });
 it('selects Telugu, persists preference, sets document language and renders translated text',async()=>{
  localStorage.clear();render(<LanguageProvider><LanguageSelector/><Probe/></LanguageProvider>);
  fireEvent.change(screen.getByTestId('language-select'),{target:{value:'te'}});
  await waitFor(()=>expect(document.documentElement.lang).toBe('te'));
  expect(localStorage.getItem('jatayu_preferred_language')).toBe('te');
  expect(screen.getByText(/Hyderabad ప్రాంతపు/)).toBeInTheDocument();
  localStorage.clear();
 });
});
