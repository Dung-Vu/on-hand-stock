/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        wood: {
          50: '#faf8f5',
          100: '#f5f1ea',
          200: '#e8ddd4',
          300: '#d4c4b0',
          400: '#b89d7a',
          500: '#9d7a5c',
          600: '#8b6b4f',
          700: '#6d5340',
          800: '#5a4535',
          900: '#4a382a',
        },
        office: {
          50: '#f9f8f6',
          100: '#f3f1ed',
          200: '#e5e0d8',
          300: '#d1c8ba',
          400: '#b8a995',
          500: '#9d8b73',
          600: '#7d6d5a',
          700: '#5d5044',
          800: '#3f3630',
          900: '#2a231f',
        },
        accent: {
          brown: '#8b6b4f',
          tan: '#d4c4b0',
          cream: '#f5f1ea',
          dark: '#4a382a',
        }
      },
      animation: {
        'gradient': 'gradient 8s linear infinite',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'glow': 'glow 2s ease-in-out infinite alternate',
      },
      keyframes: {
        gradient: {
          '0%, 100%': {
            'background-size': '200% 200%',
            'background-position': 'left center'
          },
          '50%': {
            'background-size': '200% 200%',
            'background-position': 'right center'
          }
        },
        glow: {
          '0%': {
            'box-shadow': '0 0 5px rgba(59, 130, 246, 0.5), 0 0 10px rgba(59, 130, 246, 0.3)',
          },
          '100%': {
            'box-shadow': '0 0 10px rgba(59, 130, 246, 0.8), 0 0 20px rgba(59, 130, 246, 0.5)',
          }
        }
      },
      backdropBlur: {
        xs: '2px',
      }
    },
  },
  plugins: [],
}
