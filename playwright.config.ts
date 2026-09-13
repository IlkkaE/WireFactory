import { defineConfig, devices } from '@playwright/test'
export default defineConfig({
  testDir: './tests/e2e',
  use: { baseURL: 'http://127.0.0.1:4175', channel: 'msedge' },
  projects: [
    { name: 'desktop-edge', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile-edge', use: { ...devices['iPhone 13'], browserName: 'chromium' } },
  ],
  webServer: {
    command: 'npm run preview',
    url: 'http://127.0.0.1:4175/wirefactory/',
    reuseExistingServer: false,
  },
})
