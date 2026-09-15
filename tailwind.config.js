/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['"Fraunces"', 'Georgia', 'serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      colors: {
        // Card surface on the light theme. Warmer than pure white so cards sit
        // inside the beige ground instead of punching a hole in it.
        paper: '#fffcf7',
        // One warm ramp (hue ~35°, low chroma) shared by both themes: cream
        // grounds at the top, espresso grounds at the bottom, so light and dark
        // read as the same material rather than two unrelated greys.
        ink: {
          50: '#faf7f1',
          100: '#f3eee4',
          200: '#e6dfd1',
          300: '#cfc5b3',
          // 400/500 are the secondary/tertiary text steps and are mostly used
          // without a dark: pair, so they flip via CSS vars (see index.css).
          400: 'rgb(var(--ink-400) / <alpha-value>)',
          500: 'rgb(var(--ink-500) / <alpha-value>)',
          600: '#5b5142',
          700: '#4a4137',
          800: '#332c25',
          900: '#221d18',
          950: '#1a1613',
        },
        accent: {
          DEFAULT: 'rgb(var(--accent) / <alpha-value>)',
          soft: 'rgb(var(--accent-soft) / <alpha-value>)',
          strong: 'rgb(var(--accent-strong) / <alpha-value>)',
        },
        rest: {
          DEFAULT: 'rgb(var(--rest) / <alpha-value>)',
        },
      },
      boxShadow: {
        card: '0 1px 2px rgba(58,44,30,0.05), 0 14px 30px -20px rgba(58,44,30,0.22)',
      },
      animation: {
        'breath-in': 'breathIn var(--bd, 4s) ease-in-out forwards',
        'breath-out': 'breathOut var(--bd, 4s) ease-in-out forwards',
      },
      keyframes: {
        breathIn: { '0%': { transform: 'scale(0.55)' }, '100%': { transform: 'scale(1)' } },
        breathOut: { '0%': { transform: 'scale(1)' }, '100%': { transform: 'scale(0.55)' } },
        fadeIn: { '0%': { opacity: '0', transform: 'translateY(4px)' }, '100%': { opacity: '1', transform: 'translateY(0)' } },
        ringIn: { '0%': { opacity: '0', transform: 'scale(0.94)' }, '100%': { opacity: '1', transform: 'scale(1)' } },
      },
    },
  },
  plugins: [],
}
