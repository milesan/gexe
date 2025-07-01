/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  safelist: [
    // Grid column classes for dynamic WeekSelector layout
    'grid-cols-1', 'grid-cols-2', 'grid-cols-3', 'grid-cols-4', 'grid-cols-5',
    'grid-cols-6', 'grid-cols-7', 'grid-cols-8', 'grid-cols-9', 'grid-cols-10',
    'grid-cols-11', 'grid-cols-12',
    // Responsive grid column classes
    'xxs:grid-cols-1', 'xxs:grid-cols-2', 'xxs:grid-cols-3', 'xxs:grid-cols-4', 'xxs:grid-cols-5',
    'xs:grid-cols-1', 'xs:grid-cols-2', 'xs:grid-cols-3', 'xs:grid-cols-4', 'xs:grid-cols-5',
    'sm:grid-cols-1', 'sm:grid-cols-2', 'sm:grid-cols-3', 'sm:grid-cols-4', 'sm:grid-cols-5',
    'md:grid-cols-1', 'md:grid-cols-2', 'md:grid-cols-3', 'md:grid-cols-4', 'md:grid-cols-5',
    'lg:grid-cols-1', 'lg:grid-cols-2', 'lg:grid-cols-3', 'lg:grid-cols-4', 'lg:grid-cols-5',
  ],
  theme: {
    extend: {
      screens: {
        'xxs': '360px',
      },
      fontSize: {
        // Customize the default text-base size
        'base': ['1rem', { lineHeight: '1.75rem' }],  // Default is 1rem (16px). This explicitly sets it.
        'md': ['1.122rem', { lineHeight: '1.5rem' }],
      },
      colors: {
        // Core semantic colors using CSS variables
        'bg-main': 'var(--color-bg-main)',
        'surface': 'var(--color-bg-surface)',
        'text-primary': 'var(--color-text-primary)',
        'text-secondary': 'var(--color-text-secondary)',
        'border': 'var(--color-border)',
        'accent-primary': 'var(--color-accent-primary)',
        'accent-secondary': 'var(--color-accent-secondary)',
        'white': 'var(--color-white)',
        'black': 'var(--color-black)',
        'bg-overlay': 'var(--color-bg-overlay)',
        'retro-accent': 'rgb(var(--color-retro-accent) / <alpha-value>)',
        'surface-dark': '#121212',
        'shade-1': '#B8B8AD',

        // Custom garden colors using CSS variables
        garden: {
          gold: 'var(--color-garden-gold)',
          accent: 'var(--color-garden-accent)',
          dark: 'var(--color-garden-dark)',
          matrix: 'var(--color-garden-matrix)'
        },

        // Season colors from Book2Page legend
        'season-low': '#607C8F',
        'season-medium': '#9C8450',
        'season-summer': '#9C5050',
      },
      fontFamily: {
        // VT323 as the primary font, used for main text and previously Space Mono elements
        mono: ['PP Lettra Mono Regular', 'monospace'],
        // Keep specialty fonts for specific use cases
        display: ['PP Lettra Mono Regular', 'monospace'],
        lettra: ['PP Lettra Mono Thin', 'monospace'],
        'lettra-bold': ['PP Lettra Mono Bold', 'monospace']
      }
    },
  },
  plugins: [
    require('tailwind-scrollbar')({ nocompatible: true }),
  ],
}