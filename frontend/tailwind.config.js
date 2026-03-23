/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        green:  { DEFAULT: '#1DB954', light: '#1ED760', dark: '#169C46' },
        black:  { DEFAULT: '#121212', surface: '#282828', deep: '#191414' },
        gray:   { body: '#535353', light: '#B3B3B3' },
      },
      fontFamily: {
        mono:  ['"Courier New"', 'monospace'],
        serif: ['Georgia', 'serif'],
      },
      maxWidth: { content: '640px' },
      borderRadius: { tile: '4px', pill: '500px' },
    }
  }
}
