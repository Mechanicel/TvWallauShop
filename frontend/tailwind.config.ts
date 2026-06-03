import type { Config } from 'tailwindcss';
import animate from 'tailwindcss-animate';

/**
 * Tailwind v3 – Koexistenz mit PrimeReact während der inkrementellen Migration:
 * - preflight ist AUS, damit der globale Reset die bestehenden PrimeReact-Seiten nicht verändert.
 * - Farben zeigen direkt auf Hex-CSS-Variablen (var(--accent) etc.), KEIN hsl()-Wrapper.
 *   So bleibt der Akzent eine einzige Hex-Stellschraube und Utilities wie bg-primary rendern farbig.
 * - Kein Dark-Mode (Design ist hell).
 */
export default {
   content: ['./index.html', './src/**/*.{ts,tsx}'],
   corePlugins: {
      preflight: false,
   },
   theme: {
      extend: {
         colors: {
            border: 'var(--border)',
            input: 'var(--border)',
            ring: 'var(--accent)',
            background: 'var(--background)',
            foreground: 'var(--text)',
            surface: 'var(--surface)',
            primary: {
               DEFAULT: 'var(--accent)',
               hover: 'var(--accent-hover)',
               foreground: '#FFFFFF',
            },
            muted: {
               DEFAULT: '#F1F5F9',
               foreground: '#64748B',
            },
            destructive: {
               DEFAULT: 'var(--danger)',
               foreground: '#FFFFFF',
            },
            success: {
               DEFAULT: 'var(--success)',
               foreground: '#FFFFFF',
            },
            card: {
               DEFAULT: 'var(--surface)',
               foreground: 'var(--text)',
            },
         },
         borderRadius: {
            lg: 'var(--radius)',
            md: 'calc(var(--radius) - 2px)',
            sm: 'calc(var(--radius) - 4px)',
         },
         fontFamily: {
            sans: ['"Inter Variable"', 'Inter', 'system-ui', 'sans-serif'],
         },
      },
   },
   plugins: [animate],
} satisfies Config;