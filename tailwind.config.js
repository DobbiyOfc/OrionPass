/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./*.html",
    "./*.tsx",
    "./components/**/*.{js,ts,jsx,tsx}",
    "./contexts/**/*.{js,ts,jsx,tsx}",
    "./services/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      },
      colors: {
        'background': 'hsl(var(--background))',
        'panel': 'hsl(var(--panel-hsl) / <alpha-value>)',
        'border-color': 'hsl(var(--border-color-hsl) / <alpha-value>)',
        'text-primary': 'hsl(var(--text-primary))',
        'text-secondary': 'hsl(var(--text-secondary))',
        'accent-start': 'hsl(var(--accent-start-hsl))',
        'accent-end': 'hsl(var(--accent-end-hsl))',
        'danger': '#F43F5E',
        'success': '#22C55E',
      },
      keyframes: {
        'fade-in-fast': {
          '0%': { opacity: '0', transform: 'scale(0.95)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
      },
      animation: {
        'fade-in-fast': 'fade-in-fast 0.15s ease-out',
      }
    }
  },
  plugins: [],
}