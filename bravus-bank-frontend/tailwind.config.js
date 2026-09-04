/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // Vantyx Obsidian — deep navy, electric blue and cold silver.
        bravus: {
          50:  '#eef6ff',
          100: '#d9ebff',
          200: '#a9d1ff',
          300: '#70b2ff',
          400: '#2f8cff',
          500: '#0066ff',
          600: '#0052d9',
          700: '#0642a6',
          800: '#083577',
          900: '#071e47',
          950: '#020b1d',
        },
        gold: {
          50:  '#eef6ff',
          100: '#d9ebff',
          200: '#a9d1ff',
          300: '#70b2ff',
          400: '#2f8cff',
          500: '#0066ff',
          600: '#0052d9',
          700: '#0642a6',
          800: '#083577',
          900: '#071e47',
        },
        ink: {
          50:  '#f7f9fc',
          100: '#edf1f7',
          200: '#d5dce7',
          300: '#adb8c8',
          400: '#7f8ca2',
          500: '#5d6b82',
          600: '#415068',
          700: '#29374d',
          800: '#142137',
          900: '#081322',
          950: '#020711',
        },
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        display: ['"Space Grotesk"', 'Inter', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      boxShadow: {
        'premium': '0 24px 64px -28px rgba(0, 102, 255, 0.42)',
        'gold': '0 12px 34px -12px rgba(0, 102, 255, 0.72)',
        'card': '0 18px 44px -24px rgba(0, 0, 0, 0.9)',
      },
      backgroundImage: {
        'gradient-bravus': 'linear-gradient(135deg, #020711 0%, #071e47 65%, #0066ff 100%)',
        'gradient-gold': 'linear-gradient(135deg, #0066ff 0%, #0756d8 100%)',
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
