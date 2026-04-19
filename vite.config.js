import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: '/',
  server: {
    // Pin to 5181 so `netlify dev` (which serves users on 5180) has a
    // deterministic target port and won't collide with other local projects
    // on the default 5173.
    port: 5181,
    strictPort: true,
  },
  build: { outDir: 'dist' },
})
