/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        warm: {
          50: '#FCFCFA',
          100: '#FBFBF9',
          200: '#F4F4F0',
          300: '#EAEAE4',
          400: '#D5D5CC',
        },
        navy: {
          950: '#070C1A',
          900: '#0A1128',
          850: '#0E1736',
          800: '#0F172A',
          700: '#1E293B',
          600: '#2A3B53',
        },
        slate: {
          750: '#283548',
          850: '#15202E',
        },
        alert: {
          crimson: '#DC2626',
          amber: '#D97706',
          emerald: '#16A34A',
          cyan: '#0284C7',
        }
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      boxShadow: {
        'subtle': '0 1px 3px 0 rgba(0, 0, 0, 0.05), 0 1px 2px 0 rgba(0, 0, 0, 0.03)',
        'panel': '0 2px 6px -1px rgba(0, 0, 0, 0.08), 0 1px 4px -1px rgba(0, 0, 0, 0.04)',
      }
    },
  },
  plugins: [],
}
