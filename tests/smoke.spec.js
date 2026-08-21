// Regressions-Smoke-Test — Coachee-App (Raum für Selbstwirksamkeit)
//
// Prüft nach jedem Push automatisch die Kernflüsse aus der Regressions-Checkliste
// (Projektdokumentation Kapitel 161.2), insbesondere die Navigation aus dem
// Tages-Impuls heraus (X-Button, Home-Tab) — genau die Fehlerklasse aus Kapitel 160
// ("Tages-Impuls bleibt hängen", 21.08.2026).
//
// Läuft gegen die Staging-Umgebung (rotes Banner, eigener Test-Account), niemals
// gegen echte Coachee-Daten. Zugangsdaten kommen aus GitHub Secrets, siehe
// .github/workflows/smoke-test.yml.

const { test, expect } = require('@playwright/test');

const STAGING_URL = 'https://dicostaempfli.github.io/selbstwirksamkeit-app/staging/';
const EMAIL = process.env.STAGING_TEST_EMAIL;
const PASSWORD = process.env.STAGING_TEST_PASSWORD;

test.beforeEach(() => {
  test.skip(!EMAIL || !PASSWORD, 'STAGING_TEST_EMAIL/STAGING_TEST_PASSWORD nicht gesetzt — Secrets im Repo hinterlegen.');
});

async function login(page) {
  await page.goto(STAGING_URL, { waitUntil: 'networkidle' });

  // Falls eine vorherige Session noch eingeloggt ist, ist kein Login nötig.
  const emailField = page.locator('input[type="email"]').first();
  if (await emailField.isVisible({ timeout: 5000 }).catch(() => false)) {
    await emailField.fill(EMAIL);
    await page.locator('input[type="password"]').first().fill(PASSWORD);
    await page.getByRole('button', { name: 'Anmelden' }).click();
  }

  // Erfolgreicher Login: Home-Screen mit Begrüssung erscheint.
  await expect(page.getByText(/^Guten Tag,/)).toBeVisible({ timeout: 20000 });
}

test('Login funktioniert', async ({ page }) => {
  await login(page);
});

test('Navigations-Grundgerüst: alle Tabs erreichbar', async ({ page }) => {
  await login(page);

  for (const label of ['Chat', 'Impulse', 'Mediathek', 'Termine', 'Konto']) {
    await page.locator('.bottom-nav-item, .sb-item').filter({ hasText: label }).first().click();
    await page.waitForTimeout(600);
    // Grober Crash-Check: kein Crash-Screen, keine leere Seite.
    await expect(page.locator('body')).not.toContainText('Die Verbindung dauert länger als erwartet');
  }

  await page.locator('.bottom-nav-item, .sb-item').filter({ hasText: 'Home' }).first().click();
  await expect(page.getByText(/^Guten Tag,/)).toBeVisible();
});

test('Regression Kapitel 160: X-Button verlässt Tages-Impuls zuverlässig Richtung Home', async ({ page }) => {
  await login(page);

  await page.locator('.bottom-nav-item, .sb-item').filter({ hasText: 'Impulse' }).first().click();
  await page.getByText('Tages-Impuls', { exact: true }).click();
  await page.waitForTimeout(500);

  await page.locator('button[aria-label="Schliessen"]').first().click();

  // Muss zuverlässig auf Home landen — nicht auf Tages-Impuls hängen bleiben
  // (siehe Kapitel 160: Auto-Redirect-Effect schickte sofort wieder zurück).
  await expect(page.getByText(/^Guten Tag,/)).toBeVisible({ timeout: 5000 });
});

test('Regression Kapitel 160: Home-Tab verlässt Tages-Impuls zuverlässig', async ({ page }) => {
  await login(page);

  await page.locator('.bottom-nav-item, .sb-item').filter({ hasText: 'Impulse' }).first().click();
  await page.getByText('Tages-Impuls', { exact: true }).click();
  await page.waitForTimeout(500);

  await page.locator('.bottom-nav-item, .sb-item').filter({ hasText: 'Home' }).first().click();

  await expect(page.getByText(/^Guten Tag,/)).toBeVisible({ timeout: 5000 });
});
