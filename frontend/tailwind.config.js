/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Master Jatayu Color Palette
        jatayu: {
          primary: '#F0F7F4',
          secondary: '#B5C5BF',
          muted: '#8A9C95',
          disabled: '#71827B',
          accent: '#42F5B0',
          link: '#64DDB5',
        },
        'jatayu-primary': '#F0F7F4',
        'jatayu-secondary': '#B5C5BF',
        'jatayu-muted': '#8A9C95',
        'jatayu-disabled': '#71827B',
        'jatayu-accent': '#42F5B0',
        'jatayu-link': '#64DDB5',
        obsidian: {
          DEFAULT: '#080D0D',
          950: '#040707',
          900: '#080D0D',
          800: '#0C1312',
        },
        charcoal: {
          DEFAULT: '#101817',
          950: '#0B1110',
          900: '#101817',
          800: '#162220',
          700: '#1E2D2B',
        },
        surface: {
          base: '#080D0D',
          secondary: '#101A17',
          elevated: '#14221E',
          glass: 'rgba(255, 255, 255, 0.055)',
          border: 'rgba(255, 255, 255, 0.12)',
        },
        'dark-emerald': {
          DEFAULT: '#10251F',
          900: '#0D1E19',
          800: '#10251F',
          700: '#15332B',
          600: '#1C4339',
        },
        emerald: {
          50: '#E6FAF3',
          100: '#C2F3E2',
          200: '#8AE7C6',
          300: '#75EFC0', // Soft green
          400: '#42F5B0', // Neon mint
          500: '#00D99A', // Emerald primary
          600: '#00B882',
          700: '#009468',
          800: '#00704F',
          900: '#004D36',
        },
        mint: {
          DEFAULT: '#42F5B0',
          light: '#75EFC0',
          glow: 'rgba(66, 245, 176, 0.4)',
        },
        glass: {
          surface: 'rgba(255, 255, 255, 0.055)',
          elevated: 'rgba(255, 255, 255, 0.085)',
          hover: 'rgba(255, 255, 255, 0.12)',
          border: 'rgba(255, 255, 255, 0.12)',
          borderGlow: 'rgba(0, 217, 154, 0.3)',
        },
        // Legacy compatibility aliases for existing components
        warm: {
          50: '#080D0D',
          100: '#080D0D',
          200: '#101817',
          300: '#162220',
          400: '#1E2D2B',
        },
        navy: {
          950: '#040707',
          900: '#080D0D',
          850: '#0C1312',
          800: '#101817',
          700: '#15332B',
          600: '#1E2D2B',
        },
        slate: {
          750: '#1A2926',
          850: '#0E1716',
        },
        alert: {
          crimson: '#EF4444',
          amber: '#F59E0B',
          emerald: '#00D99A',
          cyan: '#06B6D4',
        }
      },
      textColor: {
        'jatayu-primary': '#F0F7F4',
        'jatayu-secondary': '#B5C5BF',
        'jatayu-muted': '#8A9C95',
        'jatayu-disabled': '#71827B',
        'jatayu-accent': '#42F5B0',
        'jatayu-link': '#64DDB5',
        'navy-900': '#F0F7F4',
        'navy-950': '#F0F7F4',
      },
      fontFamily: {
        sans: ['Manrope', 'Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      boxShadow: {
        'subtle': '0 1px 3px 0 rgba(0, 0, 0, 0.4), 0 1px 2px 0 rgba(0, 0, 0, 0.3)',
        'panel': '0 4px 20px -2px rgba(0, 0, 0, 0.6), inset 0 1px 0 0 rgba(255, 255, 255, 0.08)',
        'bento': '0 10px 30px -5px rgba(0, 0, 0, 0.65), inset 0 1px 1px 0 rgba(255, 255, 255, 0.12)',
        'glow-emerald': '0 0 25px -4px rgba(0, 217, 154, 0.35)',
        'glow-mint': '0 0 35px -5px rgba(66, 245, 176, 0.4)',
        'glow-crimson': '0 0 25px -4px rgba(239, 68, 68, 0.35)',
        'glow-amber': '0 0 25px -4px rgba(245, 158, 11, 0.35)',
      },
      backdropBlur: {
        xs: '2px',
        md: '12px',
        lg: '16px',
        xl: '24px',
      }
    },
  },
  plugins: [],
}
