/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // Bravus Premium palette — midnight navy + gold accents
        bravus: {
          50:  '#f3f5fb',
          100: '#e6eaf6',
          200: '#bcc7e4',
          300: '#92a4d3',
          400: '#4f6bb0',
          500: '#0c328e',
          600: '#0a2a78',
          700: '#082261',
          800: '#061a49',
          900: '#040f2e',
          950: '#020717',
        },
        gold: {
          50:  '#fdf9ec',
          100: '#fbf2c8',
          200: '#f5e08e',
          300: '#eecb54',
          400: '#e6b62e',
          500: '#d49b1c',
          600: '#b07916',
          700: '#8b5b14',
          800: '#704818',
          900: '#5e3c19',
        },
        ink: {
          50:  '#f7f8fa',
          100: '#eef0f4',
          200: '#d6dae3',
          300: '#b4bbcb',
          400: '#8a93ac',
          500: '#6b758f',
          600: '#525c75',
          700: '#3f475c',
          800: '#2b3247',
          900: '#171c2c',
          950: '#0b0f1c',
        },
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        display: ['"Space Grotesk"', 'Inter', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      boxShadow: {
        'premium': '0 10px 40px -10px rgba(4, 15, 46, 0.5)',
        'gold': '0 8px 30px -8px rgba(212, 155, 28, 0.4)',
        'card': '0 4px 24px -4px rgba(0, 0, 0, 0.35)',
      },
      backgroundImage: {
        'gradient-bravus': 'linear-gradient(135deg, #040f2e 0%, #082261 60%, #0c328e 100%)',
        'gradient-gold': 'linear-gradient(135deg, #d49b1c 0%, #eecb54 100%)',
        'gradient-glass': 'linear-gradient(135deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.02) 100%)',
      },
      animation: {
        'fade-in': 'fadeIn 0.4s ease-out',
        'slide-up': 'slideUp 0.5s ease-out',
        'shimmer': 'shimmer 2.4s linear infinite',
      },
      keyframes: {
        fadeIn: { '0%': { opacity: 0 }, '100%': { opacity: 1 } },
        slideUp: {
          '0%': { opacity: 0, transform: 'translateY(12px)' },
          '100%': { opacity: 1, transform: 'translateY(0)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },
    },
  },
  plugins: [],
};
