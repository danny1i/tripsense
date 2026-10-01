import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

/** Automated WCAG 2.x A/AA checks (axe-core) on each main screen. */
const wcag = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

// Check final colours, not elements caught mid fade-in animation.
test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
});

async function expectNoViolations(page: import('@playwright/test').Page) {
  const results = await new AxeBuilder({ page }).withTags(wcag).analyze();
  expect(results.violations.map((v) => `${v.id}: ${v.nodes.length} node(s) — ${v.help}`)).toEqual([]);
}

test('landing page has no detectable accessibility violations', async ({ page }) => {
  await page.goto('/');
  await expectNoViolations(page);
});

test('results and trip pages have no detectable accessibility violations', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Describe the trip you want').fill('Find me a cheap 4-day trip somewhere warm in November.');
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { name: /I found \d+ trips/ })).toBeVisible({ timeout: 10_000 });
  await page.getByRole('button', { name: /Agent activity/ }).click();
  await page.getByRole('button', { name: 'Filters' }).click();
  await expectNoViolations(page);

  await page.getByRole('button', { name: /View trip/ }).first().click();
  await expect(page.getByRole('heading', { name: 'Why this matches' })).toBeVisible();
  await expectNoViolations(page);
});

test('engineering page has no detectable accessibility violations', async ({ page }) => {
  await page.goto('/#/engineering');
  await expect(page.getByRole('heading', { name: 'Engineering behind the experience' })).toBeVisible();
  await expectNoViolations(page);
});
