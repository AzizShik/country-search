export interface ApiLanguage {
  name?: string;
  nativeName?: string;
  iso639_1?: string;
  iso639_2?: string;
}

export interface ApiCurrency {
  code?: string;
  name?: string;
  symbol?: string;
}

export interface RawCountry {
  name: string;
  nativeName?: string;
  flag?: string;
  flags?: {
    png?: string;
    svg?: string;
  };
  capital?: string;
  region?: string;
  subregion?: string;
  population?: number;
  area?: number;
  borders?: string[];
  demonym?: string;
  languages?: ApiLanguage[];
  currencies?: ApiCurrency[];
  alpha2Code?: string;
}

export interface Country {
  name: string;
  nativeName: string;
  flagUrl: string;
  flagEmoji: string;
  capital: string;
  region: string;
  subregion: string;
  population: number;
  area: number | null;
  borders: string[];
  languages: string[];
  currencies: string[];
  description: string;
  alpha2Code: string;
}
