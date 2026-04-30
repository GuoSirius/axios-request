import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { viteMockServe } from 'vite-plugin-mock';
import UnoCSS from 'unocss/vite';

export default defineConfig({
  plugins: [
    vue(),
    UnoCSS(),
    viteMockServe({
      mockPath: 'src/mock',
      localEnabled: true,
    }),
  ],
  server: {
    host: '0.0.0.0',
    port: 3000,
    allowedHosts: true,
  },
});
