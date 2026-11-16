import { describe, expect, it } from 'vitest';

import { mapCountryResponse } from '../src/api/map-country.js';

const spainResponse = {
  name: 'Spain',
  nativeName: 'España',
  flag: '🇪🇸',
  flags: {
    png: 'https://flagcdn.com/w320/es.png',
    svg: 'https://flagcdn.com/es.svg',
  },
  capital: 'Madrid',
  region: 'Europe',
  subregion: 'Southern Europe',
  population: 47351567,
  area: 505992,
  borders: ['AND', 'FRA', 'GIB', 'PRT', 'MAR'],
  demonym: 'Spanish',
  languages: [{ name: 'Spanish', iso639_1: 'es', nativeName: 'Español' }],
  currencies: [{ code: 'EUR', name: 'Euro', symbol: '€' }],
  alpha2Code: 'ES',
};

describe('mapCountryResponse', () => {
  it('should map the fields needed by a country card', () => {
    const country = mapCountryResponse(spainResponse);

    expect(country.name).toBe('Spain');
    expect(country.flagUrl).toBe('https://flagcdn.com/es.svg');
    expect(country.flagEmoji).toBe('🇪🇸');
    expect(country.capital).toBe('Madrid');
    expect(country.region).toBe('Europe');
    expect(country.population).toBe(47351567);
    expect(country.languages).toEqual(['Spanish']);
  });

  it('should map the fields needed by the detail view', () => {
    const country = mapCountryResponse(spainResponse);

    expect(country.nativeName).toBe('España');
    expect(country.area).toBe(505992);
    expect(country.borders).toEqual(['AND', 'FRA', 'GIB', 'PRT', 'MAR']);
    expect(country.currencies).toEqual(['Euro (EUR)']);
    expect(country.alpha2Code).toBe('ES');
    expect(country.description).toContain('España');
    expect(country.description).toContain('Southern Europe');
  });

  it('should use safe fallbacks when optional fields are missing', () => {
    const country = mapCountryResponse({ name: 'Atlantis' });

    expect(country.flagUrl).toBe('');
    expect(country.flagEmoji).toBe('');
    expect(country.capital).toBe('No capital data');
    expect(country.region).toBe('Unknown region');
    expect(country.nativeName).toBe('Atlantis');
    expect(country.population).toBe(0);
    expect(country.languages).toEqual([]);
    expect(country.currencies).toEqual([]);
    expect(country.area).toBeNull();
    expect(country.borders).toEqual([]);
    expect(country.description).toBe('Atlantis is a country.');
  });

  it('should not mutate the raw response', () => {
    const raw = structuredClone(spainResponse);

    mapCountryResponse(raw);

    expect(raw).toEqual(spainResponse);
  });
});
