/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx}",
  ],
  theme: {
    extend: {
      colors: {
        'bg-base': '#0a0d14',
        'bg-surface': '#111827',
        'bg-card': '#1a2236',
        'bg-card-hover': '#1f2a42',
        'accent': '#6366f1',
        'accent-light': '#818cf8',
        'accent-2': '#06b6d4',
        'critical': '#ef4444',
        'high': '#f97316',
        'medium': '#eab308',
        'low': '#22c55e',
        'text-primary': '#f1f5f9',
        'text-secondary': '#94a3b8',
        'text-muted': '#475569',
      },
    },
  },
  plugins: [],
}
