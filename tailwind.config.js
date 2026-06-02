/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./**/*.html",
    "./js/**/*.js"
  ],
  theme: {
    extend: {
      colors: {
        'void': '#0B0B0C',
        'surface': '#161618',
        'surface-light': '#1E1E22',
        'surface-border': '#2A2A30',
        'mint': '#2a8a4a',
        'mint-light': '#3da86a',
        'mint-dark': '#1e6b38',
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
        'pulse-mint': 'pulseMint 2s ease-in-out infinite',
        'float': 'float 6s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: { '0%': { opacity: '0' }, '100%': { opacity: '1' } },
        slideUp: { '0%': { opacity: '0', transform: 'translateY(30px)' }, '100%': { opacity: '1', transform: 'translateY(0)' } },
        slideInRight: { '0%': { transform: 'translateX(100%)' }, '100%': { transform: 'translateX(0)' } },
        slideOutRight: { '0%': { transform: 'translateX(0)' }, '100%': { transform: 'translateX(100%)' } },
        pulseMint: { '0%, 100%': { boxShadow: '0 0 0 0 rgba(42, 138, 74, 0.4)' }, '50%': { boxShadow: '0 0 20px 5px rgba(42, 138, 74, 0.2)' } },
        float: { '0%, 100%': { transform: 'translateY(0)' }, '50%': { transform: 'translateY(-10px)' } },
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-mint': 'linear-gradient(135deg, #2a8a4a 0%, #3da86a 50%, #2a8a4a 100%)',
      },
      boxShadow: {
        'mint': '0 0 30px rgba(42, 138, 74, 0.15)',
        'mint-lg': '0 0 60px rgba(42, 138, 74, 0.2)',
        'surface': '0 4px 24px rgba(0, 0, 0, 0.4)',
      },
    },
  },
  plugins: [],
}
