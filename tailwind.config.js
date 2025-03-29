/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        garden: {
          gold: '#FFBF00',
          accent: '#FFD700',
          dark: '#000000',
          matrix: '#4CD964'
        }
      },
      fontFamily: {
        mono: ['Space Mono', 'monospace'],
        display: ['VT323', 'monospace'],
        serif: ['Playfair Display', 'serif'],
        body: ['Lora', 'serif'],
        lettra: ['PP Lettra Mono Thin', 'monospace'],
        regular: ['Space Mono', 'monospace']
      }
    },
  },
  plugins: [
    require('tailwind-scrollbar')({ nocompatible: true }),
  ],
}