/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        cyber: {
          bg: '#080c14',
          surface: '#0f172a',
          card: '#131e33',
          border: '#1e293b',
          input: '#152037',
          accent: '#0284c7',
          accentHover: '#0369a1',
          cyan: '#06b6d4'
        }
      }
    },
  },
  plugins: [],
}
