import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// 公式ドキュメントの設定そのまま。
// ※ growiReact は process.env.NODE_ENV === 'production' で GROWI の React に切り替わる。
//   `define: { 'process.env': {} }` のような上書きをするとこの判定が壊れるので入れないこと。
export default defineConfig({
  plugins: [react()],
  build: {
    manifest: true,
    rollupOptions: {
      input: ['/client-entry.tsx'],
    },
  },
});