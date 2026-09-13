import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react()],
  // Decaid serves the skin from a port it assigns; absolute asset URLs 404.
  base: './',
  build: {
    // Pinned to the tablet's Android System WebView. Raise once that version is
    // confirmed; see browserslist in package.json.
    target: ['es2019', 'chrome74', 'safari13'],
  },
  server: { host: true },
})
