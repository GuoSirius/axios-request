import { defineConfig, presetUno, presetAttributify } from 'unocss';

export default defineConfig({
  presets: [
    presetUno(),
    presetAttributify(),
  ],
  theme: {
    colors: {
      primary: '#6366f1',
      secondary: '#8b5cf6',
      accent: '#f472b6',
      success: '#22c55e',
      warning: '#f59e0b',
      error: '#ef4444',
      light: 'rgba(255, 255, 255, 0.85)',
      dark: {
        DEFAULT: '#1a1a2e',
        lighter: '#252542',
        darker: '#0f0f1a',
      },
    },
  },
  shortcuts: {
    'card-glow': 'bg-dark/50 rounded-xl p-6 border border-dark-lighter backdrop-blur-sm transition-all hover:border-primary/30',
    'btn-primary': 'px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/80 transition-colors',
    'btn-secondary': 'px-4 py-2 bg-secondary text-white rounded-lg hover:bg-secondary/80 transition-colors',
    'input-base': 'w-full px-4 py-2 bg-dark border border-dark-lighter rounded-lg focus:border-primary focus:outline-none transition-colors',
  },
});
