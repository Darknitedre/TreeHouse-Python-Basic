// Warm, high-contrast palettes for light and dark mode.

export interface Palette {
  background: string;
  card: string;
  cardBorder: string;
  text: string;
  textMuted: string;
  primary: string;
  /** Text/icon color drawn on top of `primary` */
  onPrimary: string;
  primarySoft: string;
  success: string;
  successSoft: string;
  danger: string;
  track: string;
  highlight: string;
}

export const lightPalette: Palette = {
  background: '#FBF6EE',
  card: '#FFFFFF',
  cardBorder: '#EADFCF',
  text: '#2B2118',
  textMuted: '#6E5E4E',
  primary: '#9C5B1C',
  onPrimary: '#FFFFFF',
  primarySoft: '#F5E6D3',
  success: '#2F7D4F',
  successSoft: '#DDF0E3',
  danger: '#B3261E',
  track: '#EADFCF',
  highlight: '#FFF0C2',
};

export const darkPalette: Palette = {
  background: '#17130F',
  card: '#241D17',
  cardBorder: '#3A3027',
  text: '#F4ECE1',
  textMuted: '#BFAF9C',
  primary: '#E6A65D',
  onPrimary: '#1E1408',
  primarySoft: '#3A2C1E',
  success: '#7CCB98',
  successSoft: '#1F3A29',
  danger: '#F2B8B5',
  track: '#3A3027',
  highlight: '#4A3B1C',
};
