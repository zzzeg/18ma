import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined
          const normalizedId = id.replace(/\\/g, '/')
          if (normalizedId.includes('/@element-plus/icons-vue/')) return 'element-icons'
          if (normalizedId.includes('/element-plus/es/components/')) return 'element-plus-components'
          if (normalizedId.includes('/element-plus/')) return 'element-plus-core'
          if (id.includes('vue') || id.includes('pinia') || id.includes('vue-router')) return 'vue-vendor'
          return 'vendor'
        },
      },
    },
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true
      }
    }
  }
})
