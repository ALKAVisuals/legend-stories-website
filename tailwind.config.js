/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./product-page.html",
    "./js/**/*.js"
  ],
  theme: {
    extend: {
      colors: {
        // Dark & Cinematic Palette
        'void': '#0B0B0C',
        'surface': '#161618',
        'surface-light': '#1E1E22',
        'surface-border': '#2A2A30',
        'gold': '#00FF41',
        'gold-light': '#33FF66',
        'gold-dark': '#00CC33',
        'text-primary': '#F5F5F7',
        'text-secondary': '#A0A0B0',
        'text-muted': '#6B6B7B',
      },
      fontFamily: {
        'display': ['"Playfair Display"', 'Georgia', 'serif'],
        'body': ['"Inter"', 'system-ui', 'sans-serif'],
      },
      animation: {
        'fade-in': 'fadeIn 0.6s ease-out forwards',
        'slide-up': 'slideUp 0.5s ease-out forwards',
        'slide-in-right': 'slideInRight 0.3s ease-out forwards',
        'slide-out-right': 'slideOutRight 0.3s ease-in forwards',
        'pulse-gold': 'pulseGold 2s ease-in-out infinite',
        'float': 'float 6s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(30px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideInRight: {
          '0%': { transform: 'translateX(100%)' },
          '100%': { transform: 'translateX(0)' },
        },
        slideOutRight: {
          '0%': { transform: 'translateX(0)' },
          '100%': { transform: 'translateX(100%)' },
        },
        pulseGold: {
          '0%, 100%': { boxShadow: '0 0 0 0 rgba(0, 255, 65, 0.4)' },
          '50%': { boxShadow: '0 0 20px 5px rgba(0, 255, 65, 0.2)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' },
        },
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-gold': 'linear-gradient(135deg, #00FF41 0%, #33FF66 50%, #00FF41 100%)',
      },
      boxShadow: {
        'gold': '0 0 30px rgba(0, 255, 65, 0.15)',
        'gold-lg': '0 0 60px rgba(0, 255, 65, 0.2)',
        'surface': '0 4px 24px rgba(0, 0, 0, 0.4)',
      },
    },
  },
  plugins: [],
}
