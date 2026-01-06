import type { Config } from 'tailwindcss';

export default {
  content: [
    "./web/src/**/*.{html,js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      // OpenAI Apps SDK Design Guidelines: Use system-native fonts
      fontFamily: {
        sans: ['system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', 'monospace'],
      },
      // OpenAI Apps SDK Design Guidelines: Use system-defined color palettes
      // Using CSS variables for theme-aware colors (defined in index.css)
      colors: {
        // Text colors (automatically theme-aware via CSS variables)
        text: {
          primary: 'rgb(var(--color-text-primary) / <alpha-value>)',
          secondary: 'rgb(var(--color-text-secondary) / <alpha-value>)',
        },
        // Background colors (automatically theme-aware via CSS variables)
        background: {
          primary: 'rgb(var(--color-bg-primary) / <alpha-value>)',
          secondary: 'rgb(var(--color-bg-secondary) / <alpha-value>)',
          tertiary: 'rgb(var(--color-bg-tertiary) / <alpha-value>)',
        },
        // Border colors (automatically theme-aware via CSS variables)
        border: {
          DEFAULT: 'rgb(var(--color-border) / <alpha-value>)',
        },
        // Status/accent colors - used sparingly per guidelines
        accent: {
          success: '#10b981',
          warning: '#f59e0b',
          danger: '#ef4444',
        },
        // Button colors (automatically theme-aware via CSS variables)
        button: {
          bg: 'rgb(var(--color-button-bg) / <alpha-value>)',
          text: 'rgb(var(--color-button-text) / <alpha-value>)',
        },
        // Card colors (automatically theme-aware via CSS variables)
        card: {
          bg: 'rgb(var(--color-card-bg) / <alpha-value>)',
          border: 'rgb(var(--color-card-border) / <alpha-value>)',
        },
      },
      // OpenAI Apps SDK Design Guidelines: Limit font size variation
      fontSize: {
        // Standard sizes for body content
        'display': ['56px', { lineHeight: '1', fontWeight: '600', letterSpacing: '-0.02em' }],
        'heading': ['17px', { lineHeight: '1.4', fontWeight: '600' }],
        'body': ['15px', { lineHeight: '1.4', fontWeight: '500' }],
        'body-small': ['13px', { lineHeight: '1.4', fontWeight: '400' }],
        'caption': ['12px', { lineHeight: '1.3', fontWeight: '400' }],
      },
      // OpenAI Apps SDK Design Guidelines: Respect system corner radius
      borderRadius: {
        DEFAULT: '8px',
        sm: '6px',
        md: '8px',
        lg: '12px',
      },
      // OpenAI Apps SDK Design Guidelines: System grid spacing
      spacing: {
        '1': '4px',
        '2': '8px',
        '3': '12px',
        '4': '16px',
        '5': '20px',
        '6': '24px',
        '8': '32px',
        '10': '40px',
        '12': '48px',
      },
    },
  },
  plugins: [
    require('@tailwindcss/forms')({
      strategy: 'class', // Use class strategy to avoid global form resets
    }),
  ],
} satisfies Config;
