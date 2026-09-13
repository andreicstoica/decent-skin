import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react()],
  // Decaid serves a skin from a folder on an assigned port. Relative asset URLs
  // keep the build working regardless of the port it lands on.
  base: './',
  build: {
    // The Decent tablet ships an old Android System WebView. Raise this only
    // after checking the WebView version on the actual tablet.
    target: ['es2019', 'chrome74', 'safari13'],
  },
  server: { host: true },
})
