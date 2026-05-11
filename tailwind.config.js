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
          50: '#f7f7f8',
          100: '#eeeef0',
          200: '#d9d9df',
          300: '#b4b4bf',
          400: '#8a8a99',
          500: '#646473',
          600: '#4a4a57',
          700: '#363642',
          800: '#22222b',
          900: '#15151b',
          950: '#0b0b10',
        },
        ember: {
          400: '#ff8a5b',
          500: '#ff6a37',
          600: '#e04f1f',
        },
      },
      animation: {
        'breath-in': 'breathIn var(--bd, 4s) ease-in-out forwards',
        'breath-out': 'breathOut var(--bd, 4s) ease-in-out forwards',
      },
      keyframes: {
        breathIn: { '0%': { transform: 'scale(0.55)' }, '100%': { transform: 'scale(1)' } },
        breathOut: { '0%': { transform: 'scale(1)' }, '100%': { transform: 'scale(0.55)' } },
      },
    },
  },
  plugins: [],
}
