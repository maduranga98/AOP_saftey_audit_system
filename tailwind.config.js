/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: { sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'] },
      colors: {
        band: { green: '#16a34a', amber: '#d97706', red: '#dc2626', grey: '#94a3b8' },
      },
    },
  },
  plugins: [],
};
