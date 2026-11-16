import type { Country, RawCountry } from './types.js';

function clean(value: string | undefined): string {
  return value?.trim() ?? '';
}

export function mapCountryResponse(raw: RawCountry): Country {
  const name = clean(raw.name) || 'Unknown country';
  const nativeName = clean(raw.nativeName) || name;
  const region = clean(raw.region) || 'Unknown region';
  const subregion = clean(raw.subregion);
  const demonym = clean(raw.demonym);

  const languages = (raw.languages ?? [])
    .map((language) => clean(language.name))
    .filter((language) => language.length > 0);

  const currencies = (raw.currencies ?? [])
    .map((currency) => {
      const code = clean(currency.code);
      const currencyName = clean(currency.name);

      if (currencyName && code) {
        return `${currencyName} (${code})`;
      }

      return currencyName || code;
    })
    .filter((currency) => currency.length > 0);

  const namePart = nativeName === name ? name : `${name} (${nativeName})`;
  const location = subregion || region;
  const locationPart = location === 'Unknown region' ? '' : ` in ${location}`;
  const demonymPart = demonym ? ` Demonym: ${demonym}.` : '';

  return {
    name,
    nativeName,
    flagUrl: clean(raw.flags?.svg) || clean(raw.flags?.png),
    flagEmoji: clean(raw.flag),
    capital: clean(raw.capital) || 'No capital data',
    region,
    subregion,
    population:
      typeof raw.population === 'number' && Number.isFinite(raw.population) ? raw.population : 0,
    area: typeof raw.area === 'number' && Number.isFinite(raw.area) ? raw.area : null,
    borders: [...(raw.borders ?? [])],
    languages,
    currencies,
    description: `${namePart} is a country${locationPart}.${demonymPart}`,
    alpha2Code: clean(raw.alpha2Code),
  };
}
