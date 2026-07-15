import { defineConfig } from 'vite'

const backendProxyTarget = process.env.VITE_BACKEND_PROXY_TARGET || 'http://localhost:4001'
const allowedHosts = [
  'onhand-stock.nport.link',
  '.nport.link',
  'stock.bonstu.site',
  '.bonstu.site'
]
const proxy = {
  // Proxy Odoo API requests to bypass CORS
  '/api/odoo': {
    target: 'https://bonario-vietnam.odoo.com',
    changeOrigin: true,
    rewrite: (path) => path.replace(/^\/api\/odoo/, '/jsonrpc'),
    secure: true,
    configure: (proxy, _options) => {
      proxy.on('error', (err, _req, _res) => {
        console.log('proxy error', err);
      });
      proxy.on('proxyReq', (proxyReq, req, _res) => {
        console.log('Sending Request to Odoo:', req.method, req.url);
      });
      proxy.on('proxyRes', (proxyRes, req, _res) => {
        console.log('Received Response from Odoo:', proxyRes.statusCode, req.url);
      });
    },
  },
  '/api': {
    target: backendProxyTarget,
    changeOrigin: true,
    secure: false,
  },
  '/ws': {
    target: backendProxyTarget,
    ws: true,
    changeOrigin: true,
  }
}

export default defineConfig({
  server: {
    port: 5178, // Local dev port (Docker uses 8080)
    strictPort: false,
    open: process.env.VITE_OPEN !== 'false',
    host: true, // Allow access from network
    allowedHosts,
    proxy
  },
  preview: {
    port: 5178,
    strictPort: false,
    host: true,
    allowedHosts,
    proxy
  },
  build: {
    // Code splitting for better caching
    rollupOptions: {
      output: {
        manualChunks(id) {
          // Split large libraries into separate chunks
          if (!id.includes('node_modules')) return undefined
          if (id.includes('exceljs')) return 'exceljs'
          if (id.includes('jspdf')) return 'jspdf'
          if (id.includes('html2canvas')) return 'html2canvas'
          if (id.includes('dompurify')) return 'dompurify'
          return undefined
        }
      }
    },
    // Increase warning limit (optional)
    chunkSizeWarningLimit: 600
  }
})
