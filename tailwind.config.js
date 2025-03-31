/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Core semantic colors using CSS variables
        'bg-main': 'var(--color-bg-main)',
        'bg-surface': 'var(--color-bg-surface)',
        'text-primary': 'var(--color-text-primary)',
        'text-secondary': 'var(--color-text-secondary)',
        'border': 'var(--color-border)',
        'accent-primary': 'var(--color-accent-primary)',
        'accent-secondary': 'var(--color-accent-secondary)',
        'white': 'var(--color-white)',
        'black': 'var(--color-black)',
        'bg-overlay': 'var(--color-bg-overlay)',

        // Custom garden colors using CSS variables
        garden: {
          gold: 'var(--color-garden-gold)',
          accent: 'var(--color-garden-accent)',
          dark: 'var(--color-garden-dark)',
          matrix: 'var(--color-garden-matrix)'
        }
      },
      fontFamily: {
        mono: ['Space Mono', 'monospace'],
        display: ['PP Lettra Mono Regular', 'monospace'],
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