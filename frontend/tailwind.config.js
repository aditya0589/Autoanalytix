/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  safelist: [
    "lg:col-span-12",
    "lg:col-span-8",
    "lg:col-span-6",
    "lg:col-span-4",
    "lg:col-span-3",
    "col-span-12",
    "col-span-6",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        surface: {
          0: "rgb(var(--surface-0) / <alpha-value>)",
          1: "rgb(var(--surface-1) / <alpha-value>)",
          2: "rgb(var(--surface-2) / <alpha-value>)",
        },
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      borderRadius: {
        xl: "0.75rem",
        "2xl": "1rem",
        "3xl": "1.5rem",
        "4xl": "2rem",
      },
      boxShadow: {
        'xs': '0 1px 2px 0 rgb(0 0 0 / 0.05)',
        'glow-indigo': '0 0 30px -5px rgb(99 102 241 / 0.3)',
        'glow-blue': '0 0 30px -5px rgb(59 130 246 / 0.3)',
        'glow-purple': '0 0 30px -5px rgb(168 85 247 / 0.3)',
      },
      animation: {
        'shimmer': 'shimmer 1.4s ease infinite',
        'fade-in': 'fadeIn 0.3s ease forwards',
        'slide-up': 'slideUp 0.35s ease forwards',
        'scale-in': 'scaleIn 0.25s ease forwards',
        'pulse-soft': 'pulse-soft 2s ease-in-out infinite',
        'spin-slow': 'spin 3s linear infinite',
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'hero-light': 'radial-gradient(ellipse 80% 50% at 50% -20%, rgba(99,102,241,0.12), transparent)',
        'hero-dark': 'radial-gradient(ellipse 80% 50% at 50% -20%, rgba(99,102,241,0.15), transparent)',
      },
      transitionTimingFunction: {
        'spring': 'cubic-bezier(0.175, 0.885, 0.32, 1.275)',
      },
    },
  },
  plugins: [],
}
