/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        erp: {
          bg: 'var(--erp-bg)',
          surface: 'var(--erp-surface)',
          'surface-muted': 'var(--erp-surface-muted)',
          'surface-hover': 'var(--erp-surface-hover)',
          accent: 'var(--erp-accent)',
          'accent-hover': 'var(--erp-accent-hover)',
          'accent-subtle': 'var(--erp-accent-subtle)',
          border: 'var(--erp-border)',
          'border-strong': 'var(--erp-border-strong)',
          'text-primary': 'var(--erp-text-primary)',
          'text-secondary': 'var(--erp-text-secondary)',
          'text-muted': 'var(--erp-text-muted)',
          'success-bg': 'var(--erp-success-bg)',
          'success-text': 'var(--erp-success-text)',
          'warning-bg': 'var(--erp-warning-bg)',
          'warning-text': 'var(--erp-warning-text)',
          'danger-bg': 'var(--erp-danger-bg)',
          'danger-text': 'var(--erp-danger-text)',
          'info-bg': 'var(--erp-info-bg)',
          'info-text': 'var(--erp-info-text)',
        },
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        'erp-sm': 'var(--erp-radius-sm)',
        'erp-md': 'var(--erp-radius-md)',
        'erp-lg': 'var(--erp-radius-lg)',
      },
      boxShadow: {
        'erp-xs': 'var(--erp-shadow-xs)',
        'erp-sm': 'var(--erp-shadow-sm)',
        'erp-md': 'var(--erp-shadow-md)',
        'erp-lg': 'var(--erp-shadow-lg)',
        'erp-xl': 'var(--erp-shadow-xl)',
      },
    },
  },
  plugins: [],
};
