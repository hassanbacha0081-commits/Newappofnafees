export interface PaletteColors {
  50: string;
  100: string;
  200: string;
  300: string;
  400: string;
  500: string;
  600: string;
  700: string;
  800: string;
  900: string;
}

export interface GoldColors {
  base: string;
  light: string;
  dark: string;
  rgb: string; // r, g, b without parentheses
}

export interface ColorPalette {
  id: string;
  nameEn: string;
  nameUr: string;
  sky: PaletteColors;
  gold: GoldColors;
}

export const COLOR_PALETTES: ColorPalette[] = [
  {
    id: 'royal',
    nameEn: 'Classic Royal (Default)',
    nameUr: 'کلاسیک شاہی (ڈیفالٹ)',
    sky: {
      50: '#f0f9ff',
      100: '#e0f2fe',
      200: '#bae6fd',
      300: '#7dd3fc',
      400: '#38bdf8',
      500: '#0ea5e9',
      600: '#0284c7',
      700: '#0369a1',
      800: '#075985',
      900: '#0c4a6e',
    },
    gold: {
      base: '#D4AF37',
      light: '#F4D03F',
      dark: '#996515',
      rgb: '212, 175, 55',
    },
  },
  {
    id: 'ocean',
    nameEn: 'Ocean Pearl (Teal & Silver)',
    nameUr: 'بحری موتی (نیلگوں اور چاندی)',
    sky: {
      50: '#f0fdfa',
      100: '#ccfbf1',
      200: '#99f6e4',
      300: '#5eead4',
      400: '#2dd4bf',
      500: '#14b8a6',
      600: '#0d9488',
      700: '#0f766e',
      800: '#115e59',
      900: '#134e4a',
    },
    gold: {
      base: '#8e9aaf',
      light: '#cbc0d3',
      dark: '#4a4e69',
      rgb: '142, 154, 175',
    },
  },
  {
    id: 'forest',
    nameEn: 'Forest & Bronze (Emerald)',
    nameUr: 'جنگل اور کانسی (زمرد)',
    sky: {
      50: '#f0fdf4',
      100: '#dcfce7',
      200: '#bbf7d0',
      300: '#86efac',
      400: '#4ade80',
      500: '#10b981',
      600: '#059669',
      700: '#047857',
      800: '#065f46',
      900: '#064e3b',
    },
    gold: {
      base: '#cd7f32',
      light: '#df9f5d',
      dark: '#8c4f12',
      rgb: '205, 127, 50',
    },
  },
  {
    id: 'midnight',
    nameEn: 'Midnight Rose (Luxury)',
    nameUr: 'آدھی رات کا گلاب (لژری)',
    sky: {
      50: '#f5f3ff',
      100: '#ede9fe',
      200: '#ddd6fe',
      300: '#c4b5fd',
      400: '#a78bfa',
      500: '#8b5cf6',
      600: '#7c3aed',
      700: '#6d28d9',
      800: '#5b21b6',
      900: '#4c1d95',
    },
    gold: {
      base: '#b76e79',
      light: '#dea5a9',
      dark: '#7c464f',
      rgb: '183, 110, 121',
    },
  },
  {
    id: 'slate',
    nameEn: 'Slate & Copper (Industrial)',
    nameUr: 'سلیٹ اور تانبا (صنعتی)',
    sky: {
      50: '#f8fafc',
      100: '#f1f5f9',
      200: '#e2e8f0',
      300: '#cbd5e1',
      400: '#94a3b8',
      500: '#64748b',
      600: '#475569',
      700: '#334155',
      800: '#1e293b',
      900: '#0f172a',
    },
    gold: {
      base: '#d97706',
      light: '#fbbf24',
      dark: '#92400e',
      rgb: '217, 119, 6',
    },
  },
];

export function getPaletteStyles(paletteId: string): string {
  const palette = COLOR_PALETTES.find(p => p.id === paletteId) || COLOR_PALETTES[0];
  return `
    :root {
      --color-sky-50: ${palette.sky[50]};
      --color-sky-100: ${palette.sky[100]};
      --color-sky-200: ${palette.sky[200]};
      --color-sky-300: ${palette.sky[300]};
      --color-sky-400: ${palette.sky[400]};
      --color-sky-500: ${palette.sky[500]};
      --color-sky-600: ${palette.sky[600]};
      --color-sky-700: ${palette.sky[700]};
      --color-sky-800: ${palette.sky[800]};
      --color-sky-900: ${palette.sky[900]};

      --color-gold: ${palette.gold.base};
      --color-gold-light: ${palette.gold.light};
      --color-gold-dark: ${palette.gold.dark};

      --color-gold-5: rgba(${palette.gold.rgb}, 0.05);
      --color-gold-10: rgba(${palette.gold.rgb}, 0.1);
      --color-gold-20: rgba(${palette.gold.rgb}, 0.2);
      --color-gold-30: rgba(${palette.gold.rgb}, 0.3);
    }
  `;
}
