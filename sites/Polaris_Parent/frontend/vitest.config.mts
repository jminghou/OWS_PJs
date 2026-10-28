import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

// 讓測試也能用 Next 的 @/ 路徑別名（tsconfig paths：@/* → src/*）
export default defineConfig({
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
});
