import type { Config } from 'tailwindcss';

/**
 * Design tokens MatterGuide AI
 * ink       : fond sombre cinematique (experience de visite)
 * porcelain : fond clair (back-office agence)
 * brass     : accent laiton — signature immobiliere haussmannienne
 */
const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: { DEFAULT: '#0B0E14', 800: '#121724', 700: '#1A2132', 600: '#242E45' },
        porcelain: { DEFAULT: '#F3EFE6', dim: '#E9E3D5' },
        brass: { DEFAULT: '#C2A878', soft: '#D8C5A0', deep: '#8F7547' },
        stone: { ink: '#3C4254', mute: '#6B7280' },
      },
      fontFamily: {
        display: ['Fraunces', 'Georgia', 'serif'],
        sans: ['"Instrument Sans"', 'system-ui', 'sans-serif'],
        mono: ['"Spline Sans Mono"', 'ui-monospace', 'monospace'],
      },
      animation: {
        'halo-ping': 'haloPing 2.4s cubic-bezier(0, 0, 0.2, 1) infinite',
        'halo-pulse': 'haloPulse 1.2s ease-in-out infinite',
        'fade-up': 'fadeUp .5s ease both',
      },
      keyframes: {
        haloPing: {
          '0%': { transform: 'scale(1)', opacity: '0.6' },
          '80%, 100%': { transform: 'scale(2.1)', opacity: '0' },
        },
        haloPulse: {
          '0%, 100%': { transform: 'scale(1)' },
          '50%': { transform: 'scale(1.12)' },
        },
        fadeUp: {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
};
export default config;
