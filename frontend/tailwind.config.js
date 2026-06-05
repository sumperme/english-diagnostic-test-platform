/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        edt: {
          neon: '#CEFF1A',
          gold: '#AAA95A',
          olive: '#82816D',
          indigo: '#414066',
          forest: '#1B2D2A',
          green: '#7AC142',
          soft: '#F4F4F4',
        },
      },
      fontFamily: {
        sans: ['Montserrat', 'Noto Serif TC', 'ui-sans-serif', 'system-ui'],
        display: ['Bodoni Moda', 'serif'],
        zh: ['Noto Serif TC', 'serif'],
      },
      spacing: {
        nav: '5.5rem',
      },
      maxWidth: {
        content: '1800px',
      },
      boxShadow: {
        neon: '0 0 30px rgba(206, 255, 26, 0.3)',
      },
    },
  },
  plugins: [],
};
