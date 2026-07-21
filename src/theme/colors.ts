export const darkTheme = {
  background: '#0E0E12',
  surface: '#17171D',
  surfaceAlt: '#1F1F27',
  border: '#2A2A33',
  text: '#F5F5F7',
  textMuted: '#9A9AA5',
  accent: '#7C5CFF',
  accentMuted: '#372B66',
  danger: '#FF5C5C',
  success: '#4ADE80',
  chipBg: '#232330',
};

export const lightTheme = {
  background: '#F7F7FA',
  surface: '#FFFFFF',
  surfaceAlt: '#F0F0F5',
  border: '#E2E2EA',
  text: '#15151A',
  textMuted: '#6B6B76',
  accent: '#6B46F0',
  accentMuted: '#EDE7FF',
  danger: '#D93636',
  success: '#1E9E5A',
  chipBg: '#EFEFF6',
};

export type Theme = typeof darkTheme;

export const platformColors: Record<string, string> = {
  instagram: '#E1306C',
  tiktok: '#25F4EE',
  facebook: '#1877F2',
  youtube: '#FF0000',
  web: '#7C5CFF',
  manual: '#9A9AA5',
};
