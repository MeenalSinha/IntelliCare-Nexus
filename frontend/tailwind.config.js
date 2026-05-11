/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ['class'],
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Core palette - deep space healthcare
        void: '#050810',
        abyss: '#080d1a',
        obsidian: '#0d1426',
        slate: '#111827',
        // Accent system
        cyan: {
          glow: '#00f5ff',
          bright: '#06d6f5',
          mid: '#0891b2',
          deep: '#164e63',
        },
        teal: {
          glow: '#00ffd4',
          bright: '#2dd4bf',
          mid: '#0d9488',
        },
        violet: {
          glow: '#a855f7',
          bright: '#8b5cf6',
          mid: '#6d28d9',
          deep: '#2e1065',
        },
        emerald: {
          glow: '#00ff87',
          bright: '#34d399',
          mid: '#059669',
        },
        amber: {
          glow: '#fbbf24',
          warning: '#f59e0b',
        },
        rose: {
          alert: '#f43f5e',
          glow: '#ff4081',
        },
        // UI surfaces
        surface: {
          1: 'rgba(255,255,255,0.03)',
          2: 'rgba(255,255,255,0.06)',
          3: 'rgba(255,255,255,0.09)',
          4: 'rgba(255,255,255,0.12)',
        },
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-jetbrains)', 'monospace'],
        display: ['var(--font-outfit)', 'sans-serif'],
      },
      backgroundImage: {
        'grid-pattern': "url(\"data:image/svg+xml,%3Csvg width='40' height='40' viewBox='0 0 40 40' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%2300f5ff' fill-opacity='0.03'%3E%3Cpath d='M0 40L40 0H20L0 20M40 40V20L20 40'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E\")",
        'radial-void': 'radial-gradient(ellipse at center, #0d1426 0%, #050810 100%)',
        'hero-gradient': 'linear-gradient(135deg, #050810 0%, #0d1426 30%, #0f172a 60%, #050810 100%)',
        'cyan-glow': 'radial-gradient(ellipse at center, rgba(0,245,255,0.15) 0%, transparent 70%)',
        'violet-glow': 'radial-gradient(ellipse at center, rgba(168,85,247,0.15) 0%, transparent 70%)',
        'card-gradient': 'linear-gradient(145deg, rgba(255,255,255,0.07) 0%, rgba(255,255,255,0.02) 100%)',
      },
      boxShadow: {
        'glow-cyan': '0 0 20px rgba(0,245,255,0.3), 0 0 60px rgba(0,245,255,0.1)',
        'glow-violet': '0 0 20px rgba(168,85,247,0.3), 0 0 60px rgba(168,85,247,0.1)',
        'glow-emerald': '0 0 20px rgba(0,255,135,0.25), 0 0 60px rgba(0,255,135,0.08)',
        'glow-rose': '0 0 20px rgba(244,63,94,0.3)',
        'panel': '0 4px 24px rgba(0,0,0,0.4), 0 1px 0 rgba(255,255,255,0.06)',
        'card': '0 2px 16px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.05)',
      },
      animation: {
        'pulse-glow': 'pulseGlow 2s ease-in-out infinite',
        'data-stream': 'dataStream 3s linear infinite',
        'float': 'float 6s ease-in-out infinite',
        'scan-line': 'scanLine 4s linear infinite',
        'orbit': 'orbit 20s linear infinite',
        'typing': 'typing 3s steps(40, end)',
        'fade-in': 'fadeIn 0.5s ease-out',
        'slide-up': 'slideUp 0.4s ease-out',
        'slide-in-right': 'slideInRight 0.4s ease-out',
        'border-spin': 'borderSpin 4s linear infinite',
        'shimmer': 'shimmer 2s linear infinite',
      },
      keyframes: {
        pulseGlow: {
          '0%, 100%': { opacity: '1', filter: 'brightness(1)' },
          '50%': { opacity: '0.7', filter: 'brightness(1.4)' },
        },
        dataStream: {
          '0%': { backgroundPosition: '0% 0%' },
          '100%': { backgroundPosition: '100% 100%' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        scanLine: {
          '0%': { transform: 'translateY(-100%)' },
          '100%': { transform: 'translateY(100vh)' },
        },
        orbit: {
          '0%': { transform: 'rotate(0deg) translateX(120px) rotate(0deg)' },
          '100%': { transform: 'rotate(360deg) translateX(120px) rotate(-360deg)' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(20px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        slideInRight: {
          '0%': { transform: 'translateX(20px)', opacity: '0' },
          '100%': { transform: 'translateX(0)', opacity: '1' },
        },
        borderSpin: {
          '0%': { '--angle': '0deg' },
          '100%': { '--angle': '360deg' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-1000px 0' },
          '100%': { backgroundPosition: '1000px 0' },
        },
      },
      borderRadius: {
        xl: '0.75rem',
        '2xl': '1rem',
        '3xl': '1.5rem',
      },
      backdropBlur: {
        xs: '2px',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
}
