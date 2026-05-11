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
        // ── Stitch "Autonomous Clinical Intelligence" design tokens ──────
        background:   '#0c1322',
        surface: {
          DEFAULT:    '#0c1322',
          dim:        '#0c1322',
          bright:     '#323949',
          lowest:     '#070e1c',
          low:        '#141c2a',
          mid:        '#18202e',
          high:       '#232a39',
          highest:    '#2d3544',
          variant:    '#2d3544',
        },
        // Primary (cyan)
        primary: {
          DEFAULT:    '#00e5ff',
          container:  '#00e5ff',
          dim:        '#00daf3',
          fixed:      '#9cf0ff',
          on:         '#00363d',
          'on-container': '#00626e',
        },
        // Secondary (violet)
        secondary: {
          DEFAULT:    '#ddb7ff',
          container:  '#6f00be',
          fixed:      '#f0dbff',
          dim:        '#ddb7ff',
          on:         '#490080',
          'on-container': '#d6a9ff',
        },
        // Tertiary (emerald)
        tertiary: {
          DEFAULT:    '#aeffbf',
          container:  '#00ef7e',
          fixed:      '#60ff98',
          dim:        '#00e478',
          on:         '#003919',
          'on-container': '#006733',
        },
        // Semantic
        error: {
          DEFAULT:    '#ffb4ab',
          container:  '#93000a',
        },
        // On-surface tokens
        'on-surface':         '#dbe2f7',
        'on-surface-variant': '#bac9cc',
        outline: {
          DEFAULT:  '#849396',
          variant:  '#3b494c',
        },

        // ── Legacy aliases (keeps existing components working) ──────────
        void:     '#070e1c',
        abyss:    '#0c1322',
        obsidian: '#18202e',
        slate:    '#111827',

        cyan: {
          glow:   '#00e5ff',
          bright: '#00daf3',
          mid:    '#0891b2',
          deep:   '#164e63',
        },
        violet: {
          glow:   '#a855f7',
          bright: '#8b5cf6',
          mid:    '#6d28d9',
          deep:   '#2e1065',
        },
        emerald: {
          glow:   '#00ef7e',
          bright: '#34d399',
          mid:    '#059669',
        },
        amber:  { glow: '#fbbf24', warning: '#f59e0b' },
        rose:   { alert: '#f43f5e', glow: '#ff4081' },
        teal:   { glow: '#00ffd4', bright: '#2dd4bf', mid: '#0d9488' },
      },

      fontFamily: {
        // Stitch typography spec: Geist display, Inter body, JetBrains mono
        sans:    ['Inter', 'system-ui', 'sans-serif'],
        display: ['Geist', 'Inter', 'system-ui', 'sans-serif'],
        mono:    ['JetBrains Mono', 'monospace'],
        // legacy aliases
        body:    ['Inter', 'system-ui', 'sans-serif'],
        clinical: ['Geist', 'system-ui', 'sans-serif'],
      },

      fontSize: {
        // Stitch typography scale
        'display-lg': ['3rem', { lineHeight: '1.1', letterSpacing: '-0.02em', fontWeight: '700' }],
        'headline-lg': ['2rem', { lineHeight: '1.2', fontWeight: '600' }],
        'headline-md': ['1.5rem', { lineHeight: '1.3', fontWeight: '500' }],
        'label-caps': ['0.75rem', { lineHeight: '1.2', letterSpacing: '0.1em', fontWeight: '600' }],
        'clinical': ['0.875rem', { lineHeight: '1', fontWeight: '500' }],
      },

      backgroundImage: {
        'grid-pattern':  "url(\"data:image/svg+xml,%3Csvg width='28' height='28' viewBox='0 0 28 28' xmlns='http://www.w3.org/2000/svg'%3E%3Ccircle cx='1' cy='1' r='1' fill='%2300e5ff' fill-opacity='0.12'/%3E%3C/svg%3E\")",
        'radial-void':   'radial-gradient(ellipse at center, #141c2a 0%, #070e1c 100%)',
        'hero-gradient': 'linear-gradient(135deg, #070e1c 0%, #141c2a 35%, #18202e 70%, #070e1c 100%)',
        'cyan-glow':     'radial-gradient(ellipse at center, rgba(0,229,255,0.18) 0%, transparent 70%)',
        'violet-glow':   'radial-gradient(ellipse at center, rgba(168,85,247,0.18) 0%, transparent 70%)',
        'card-gradient': 'linear-gradient(145deg, rgba(255,255,255,0.07) 0%, rgba(255,255,255,0.02) 100%)',
        'glass-border':  'linear-gradient(180deg, rgba(255,255,255,0.10) 0%, rgba(255,255,255,0.02) 100%)',
        'btn-primary':   'linear-gradient(135deg, #00e5ff 0%, #00daf3 100%)',
        'btn-ai':        'linear-gradient(135deg, #ddb7ff 0%, #a855f7 100%)',
        'approval-meter':'linear-gradient(90deg, #f43f5e 0%, #fbbf24 40%, #00ef7e 80%, #00e5ff 100%)',
      },

      boxShadow: {
        'glow-cyan':    '0 0 20px rgba(0,229,255,0.35), 0 0 60px rgba(0,229,255,0.12)',
        'glow-violet':  '0 0 20px rgba(168,85,247,0.35), 0 0 60px rgba(168,85,247,0.12)',
        'glow-emerald': '0 0 16px rgba(0,239,126,0.3)',
        'glow-rose':    '0 0 16px rgba(244,63,94,0.3)',
        'glow-amber':   '0 0 16px rgba(251,191,36,0.3)',
        'panel':        '0 4px 24px rgba(0,0,0,0.5), 0 1px 0 rgba(255,255,255,0.06)',
        'card':         '0 2px 16px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.06)',
        'elevated':     '0 8px 40px rgba(0,0,0,0.55), 0 1px 0 rgba(255,255,255,0.08)',
      },

      borderRadius: {
        // Stitch ROUND_FOUR = 4px base
        DEFAULT: '0.25rem',
        sm:  '0.125rem',
        md:  '0.375rem',
        lg:  '0.5rem',
        xl:  '0.75rem',
        '2xl': '1rem',
        '3xl': '1.5rem',
      },

      backdropBlur: { xs: '2px', sm: '8px', md: '12px', lg: '16px', xl: '24px' },

      animation: {
        'agent-pulse':  'agentPulse 1.8s ease-in-out infinite',
        'pulse-glow':   'pulseGlow 2s ease-in-out infinite',
        'data-stream':  'dataStream 3s linear infinite',
        'fade-up':      'fadeUp 0.35s ease forwards',
        'shimmer':      'shimmer 2s linear infinite',
        'demo-border':  'demoBorderPulse 3s ease-in-out infinite',
        'glow-pulse':   'glowPulse 2s ease-in-out infinite',
      },

      keyframes: {
        agentPulse: {
          '0%,100%': { boxShadow: '0 0 0 0 rgba(0,229,255,0.5)' },
          '50%':     { boxShadow: '0 0 0 10px rgba(0,229,255,0)' },
        },
        pulseGlow: {
          '0%,100%': { opacity: '1', filter: 'brightness(1)' },
          '50%':     { opacity: '0.7', filter: 'brightness(1.4)' },
        },
        dataStream: {
          '0%':   { backgroundPosition: '0% 0%' },
          '100%': { backgroundPosition: '100% 100%' },
        },
        fadeUp: {
          from: { opacity: '0', transform: 'translateY(10px)' },
          to:   { opacity: '1', transform: 'translateY(0)' },
        },
        shimmer: {
          '0%':   { backgroundPosition: '-1000px 0' },
          '100%': { backgroundPosition: '1000px 0' },
        },
        demoBorderPulse: {
          '0%,100%': { borderColor: 'rgba(0,229,255,0.25)' },
          '50%':     { borderColor: 'rgba(168,85,247,0.65)', boxShadow: '0 0 30px rgba(168,85,247,0.2)' },
        },
        glowPulse: {
          '0%,100%': { opacity: '0.6' },
          '50%':     { opacity: '1' },
        },
      },

      spacing: {
        // Stitch 8px spatial rhythm
        '0.5': '0.125rem',
        '1':   '0.25rem',
        '2':   '0.5rem',
        '4':   '1rem',
        '6':   '1.5rem',
        '8':   '2rem',
        '12':  '3rem',
        '16':  '4rem',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
}
