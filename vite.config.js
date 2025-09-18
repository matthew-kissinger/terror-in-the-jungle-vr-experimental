import { defineConfig } from 'vite'

// https://vitejs.dev/config/
export default defineConfig({
  base: '/pix3d-open-world/',
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
  }
})