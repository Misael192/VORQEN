import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{js,ts,jsx,tsx,mdx}', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eef9ff',
          100: '#d7f1ff',
          200: '#b0e5ff',
          300: '#7ad0ff',
          400: '#39afff',
          500: '#0f8ef0',
          600: '#0d71c5',
          700: '#0d5fa8',
          800: '#144f88',
          900: '#184875'
        }
      }
    }
  },
  plugins: []
};

export default config;
