import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Own ports, so the prototype can run next to the real app (meraki-frontend uses 5173/4173).
  server: { port: 5174, strictPort: true },
  preview: { port: 4175, strictPort: true },
})
