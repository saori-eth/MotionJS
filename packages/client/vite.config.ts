import { defineConfig } from 'vite';
import glsl from 'vite-plugin-glsl';
import { resolve } from 'path';

export default defineConfig({
  plugins: [glsl()],
  server: {
    port: 3000
  },
  build: {
    outDir: 'dist',
    sourcemap: true
  },
  resolve: {
    alias: {
      '@motionjs/common': resolve(__dirname, '../common/src/index.ts')
    }
  }
});