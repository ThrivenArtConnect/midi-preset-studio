import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { copyFileSync, mkdirSync } from 'fs'

const __dirname = dirname(fileURLToPath(import.meta.url))

function copyMainCjsPlugin() {
  const files = ['sysex-protocol.js', 'raw-patch.js', 'mapping-bridge.js', 'port-test.js', 'preset-write-gate.js']
  return {
    name: 'copy-main-cjs',
    closeBundle() {
      const outDir = resolve(__dirname, 'out/main')
      mkdirSync(outDir, { recursive: true })
      for (const file of files) {
        copyFileSync(
          resolve(__dirname, 'src/main', file),
          resolve(outDir, file),
        )
      }
    },
  }
}

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin(), copyMainCjsPlugin()],
    build: {
      rollupOptions: {
        input: resolve(__dirname, 'src/main/index.js'),
      },
    },
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        input: resolve(__dirname, 'src/preload/index.js'),
      },
    },
  },
  renderer: {
    root: resolve(__dirname, 'src/renderer'),
    plugins: [react()],
    build: {
      rollupOptions: {
        input: resolve(__dirname, 'src/renderer/index.html'),
      },
    },
  },
})
