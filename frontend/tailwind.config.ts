import type { Config } from 'tailwindcss'

export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        green: {
          DEFAULT: '#1DB954',
          light: '#1ED760',
          dark: '#169C46',
        },
        black: {
          deep: '#121212',
          surface: '#282828',
          failed: '#191414',
        },
        gray: {
          body: '#535353',
          light: '#B3B3B3',
        },
        white: '#FFFFFF',
      },
      fontFamily: {
        mono: ['"Courier New"', 'monospace'],
        serif: ['Georgia', 'serif'],
      },
      spacing: {
        '1': '4px',
        '2': '8px',
        '4': '16px',
        '6': '24px',
        '12': '48px',
        '20': '80px',
      },
      maxWidth: {
        'content': '640px',
      }
    },
  },
  plugins: [],
} satisfies Config
