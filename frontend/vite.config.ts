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
          if (normalizedId.includes('/element-plus/es/components/')) {
            const match = normalizedId.match(/\/element-plus\/es\/components\/([^/]+)/)
            const componentName = match?.[1] || ''
            if (/^[a-g]/.test(componentName)) return 'element-plus-components-a-g'
            if (/^[h-p]/.test(componentName)) return 'element-plus-components-h-p'
            return 'element-plus-components-q-z'
          }
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
