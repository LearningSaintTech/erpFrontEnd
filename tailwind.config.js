/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        erp: {
          bg: 'var(--erp-bg)',
          accent: 'var(--erp-accent)',
          border: 'var(--erp-border)',
          'text-primary': 'var(--erp-text-primary)',
          'text-secondary': 'var(--erp-text-secondary)',
          'text-muted': 'var(--erp-text-muted)',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
