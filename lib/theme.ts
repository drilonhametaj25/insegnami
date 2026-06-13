import { createTheme, type MantineColorsTuple } from '@mantine/core';

/**
 * Brand InsegnaMi.pro — Navy & Ambra.
 * Palette unica condivisa da app autenticata e pagine pubbliche.
 * NIENTE gradienti/colori hardcoded nei singoli file: usare questi token.
 */

// Navy: primario. Ramp coeso che culmina nel brand #1e3a8a (shade 8).
const navy: MantineColorsTuple = [
  '#eef3fb',
  '#d9e2f3',
  '#b0c2e6',
  '#84a0d9',
  '#5f83ce',
  '#4571c8',
  '#2f5fc4', // 6 — default filled
  '#23499b', // 7
  '#1e3a8a', // 8 — brand navy
  '#172554', // 9 — deep
];

// Amber: accento/CTA secondaria.
const amber: MantineColorsTuple = [
  '#fff8eb',
  '#feefc7',
  '#fde08a',
  '#fccd4d',
  '#fbbf24',
  '#f59e0b', // 5 — accento
  '#d97706',
  '#b45309',
  '#92400e',
  '#78350f',
];

// Costanti brand riusabili (sfondi hero/sidebar, email, ecc.)
export const BRAND = {
  navy: '#1e3a8a',
  navyDeep: '#172554',
  amber: '#f59e0b',
  amberDeep: '#d97706',
  ink: '#0f172a',
  surface: '#f8fafc',
  // Gradiente navy del marchio (sidebar, hero, header)
  gradient: 'linear-gradient(135deg, #1e3a8a 0%, #172554 100%)',
  // Gradiente accento ambra (badge/CTA decorative)
  gradientAmber: 'linear-gradient(135deg, #fbbf24 0%, #d97706 100%)',
} as const;

export const appTheme = createTheme({
  primaryColor: 'navy',
  primaryShade: { light: 6, dark: 4 },
  colors: { navy, amber },
  defaultRadius: 'md',
  fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
  headings: {
    fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
    fontWeight: '700',
  },
  components: {
    Paper: { defaultProps: { shadow: 'xs', radius: 'lg' } },
    Card: { defaultProps: { shadow: 'sm', radius: 'lg', withBorder: true } },
    Button: { defaultProps: { radius: 'md' } },
    Badge: { defaultProps: { radius: 'sm' } },
  },
  shadows: {
    xs: '0 1px 2px 0 rgb(15 23 42 / 0.05)',
    sm: '0 1px 3px 0 rgb(15 23 42 / 0.08), 0 1px 2px -1px rgb(15 23 42 / 0.08)',
    md: '0 4px 6px -1px rgb(15 23 42 / 0.08), 0 2px 4px -2px rgb(15 23 42 / 0.08)',
    lg: '0 12px 20px -6px rgb(15 23 42 / 0.12), 0 4px 8px -4px rgb(15 23 42 / 0.08)',
    xl: '0 24px 40px -12px rgb(15 23 42 / 0.16)',
  },
  other: {
    gradients: {
      primary: BRAND.gradient,
      accent: BRAND.gradientAmber,
    },
  },
});
