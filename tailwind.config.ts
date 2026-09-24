import type { Config } from 'tailwindcss';

/**
 * A Tailwind color backed by one of our --ts-* tokens (web/src/index.css). color-mix keeps
 * opacity modifiers such as bg-accent-success/10 working, since the tokens are full colors
 * that follow the host theme rather than RGB triplets.
 */
const token = (name: string) =>
  `color-mix(in srgb, var(--ts-${name}) calc(<alpha-value> * 100%), transparent)`;

export default {
  content: [
    "./web/src/**/*.{html,js,ts,jsx,tsx}",
  ],
  // The host sets data-theme on <html> (applyDocumentTheme in ext-apps)
  darkMode: ['selector', '[data-theme="dark"]'],
  theme: {
    extend: {
      // Host fonts first, system fonts as fallback
      fontFamily: {
        sans: ['var(--ts-font-sans)'],
        mono: ['var(--ts-font-mono)'],
      },
      colors: {
        text: {
          primary: token('fg'),
          secondary: token('fg-muted'),
          tertiary: token('fg-subtle'),
        },
        // `text-secondary` is used for muted copy throughout the widgets
        secondary: token('fg-muted'),
        background: {
          primary: token('bg'),
          secondary: token('bg-muted'),
          tertiary: token('bg-subtle'),
        },
        surface: token('bg-muted'),
        border: {
          DEFAULT: token('border'),
        },
        accent: {
          DEFAULT: token('accent'),
          text: token('accent-text'),
          success: token('success'),
          warning: token('warning'),
          danger: token('danger'),
        },
        button: {
          bg: token('bg-muted'),
          text: token('fg'),
        },
        card: {
          bg: token('bg'),
          border: token('border'),
        },
      },
      fontSize: {
        'display': ['56px', { lineHeight: '1', fontWeight: '600', letterSpacing: '-0.02em' }],
        'heading': ['17px', { lineHeight: '1.4', fontWeight: '600' }],
        'body': ['15px', { lineHeight: '1.4', fontWeight: '500' }],
        'body-small': ['13px', { lineHeight: '1.4', fontWeight: '400' }],
        'caption': ['12px', { lineHeight: '1.3', fontWeight: '400' }],
      },
      borderRadius: {
        DEFAULT: 'var(--ts-radius-control)',
        sm: 'var(--ts-radius-sm)',
        md: 'var(--ts-radius-control)',
        lg: 'var(--ts-radius-lg)',
        card: 'var(--ts-radius-card)',
      },
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
