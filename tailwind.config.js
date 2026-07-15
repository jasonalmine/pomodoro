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
        ink: {
          50: '#f7f6f3',
          100: '#efede9',
          200: '#dcdad4',
          300: '#b7b5ad',
          400: '#8b8a83',
          500: '#66655e',
          600: '#4c4b46',
          700: '#3a3934',
          800: '#26262b',
          900: '#1b1c21',
          950: '#131318',
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
        card: '0 1px 2px rgba(20,20,25,0.04), 0 14px 30px -20px rgba(20,20,25,0.18)',
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
