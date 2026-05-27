import { defineConfig } from '@playwright/test';
export default defineConfig({ use: { browserName: 'chromium', headless: true, trace: 'retain-on-failure', screenshot: 'only-on-failure' } });
