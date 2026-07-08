import { defineConfig, minimal2023Preset } from '@vite-pwa/assets-generator/config'

export default defineConfig({
  // minimal2023Preset：生成现代 PWA 需要的全套图标（含 apple-touch-icon、maskable、favicon）
  preset: minimal2023Preset,
  // 从这个源 SVG 生成
  images: ['icon-source.svg'],
})
