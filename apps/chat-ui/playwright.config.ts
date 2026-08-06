import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1, // To avoid concurrent database edits
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    // Luôn true: khi chạy trong CI, docker-compose đã khởi động chat-ui
    // (cùng mcp-gateway/ai-orchestrator/postgres thật) trên port 3000 TRƯỚC
    // khi Playwright chạy — nếu để `!process.env.CI` (= false trong CI vì
    // GitHub Actions luôn set CI=true), Playwright sẽ cố tự spawn thêm 1
    // dev server nữa, và do vite.config.ts có strictPort:true, lệnh `npm
    // run dev` sẽ crash ngay vì port 3000 đã bị docker-compose chiếm.
    // reuseExistingServer:true giúp Playwright nhận diện server đang chạy
    // và dùng lại — vẫn tự khởi động bình thường khi chạy dev cục bộ nếu
    // chưa có server nào ở port 3000.
    reuseExistingServer: true,
    timeout: 120 * 1000,
  },
});

