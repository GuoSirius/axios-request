import { defineConfig, presetUno, transformerDirectives, transformerVariantGroup } from 'unocss';
import { presetElementPlus } from '@unocss/preset-element-plus';

export default defineConfig({
  presets: [
    presetUno(),
    presetElementPlus(), // 自动加载 Element Plus 样式
  ],
  transformers: [
    transformerDirectives(),
    transformerVariantGroup(),
  ],
  theme: {
    colors: {
      primary: '#0EA5E9',
      secondary: '#6366F1',
      accent: '#8B5CF6',
      dark: {
        DEFAULT: '#0F172A',
        light: '#1E293B',
        lighter: '#334155',
      },
      light: {
        DEFAULT: '#F1F5F9',
        dark: '#94A3B8',
      },
    },
  },
  shortcuts: {
    'btn-primary': 'px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/80 transition-all',
    'card-glow': 'bg-dark-light rounded-xl p-6 shadow-lg border border-dark-lighter relative overflow-hidden',
    'card-glow::before': 'content-empty absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-primary to-accent',
  },
});
