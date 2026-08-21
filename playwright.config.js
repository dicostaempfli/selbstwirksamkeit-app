// Playwright-Konfiguration für den Regressions-Smoke-Test (Kapitel 161.4).
// Läuft ausschliesslich gegen die Staging-Umgebung, nie gegen Live.
module.exports = {
  testDir: './tests',
  timeout: 30000,
  retries: 1,
  reporter: [['html', { outputFolder: 'playwright-report', open: 'never' }], ['list']],
  use: {
    viewport: { width: 390, height: 844 }, // iPhone-Grösse, App ist mobile-first
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
};
