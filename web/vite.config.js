import { defineConfig } from 'vite'

export default defineConfig({
  root: '.',
  server: {
    port: 3004,
    host: true,
    open: true
  },
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: {
        main: './index.html',
        dashboard: './pages/app/dashboard.html',
        voiceDashboard: './pages/app/voice-dashboard.html',
        voiceTest: './pages/app/voice-test.html',
        chat: './pages/app/chat.html',
        sop: './pages/app/sop-workspace.html',
        compare: './pages/app/university-comparison.html',
        recommend: './pages/app/university-recommender.html'
      }
    }
  },
  publicDir: 'public'
}) 