import { expect, test } from '@playwright/test';

/**
 * The demo journey from docs/demo-script.md:
 * Search → Agent → Results → Refinement → Trip details → Ask AI → Engineering.
 */
test('conversational search journey', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1, name: 'Where do you want to go?' })).toBeVisible();
  await expect(page.getByText('Demo Mode').first()).toBeAttached();

  // 1. Natural-language search
  await page.getByLabel('Describe the trip you want').fill('Find me a cheap 4-day trip somewhere warm in November.');
  await page.getByRole('button', { name: 'Search' }).click();

  // 2. Agent activity and structured preferences
  const prefs = page.getByRole('list', { name: 'Your current preferences' });
  await expect(prefs.getByText('Warm destination')).toBeVisible();
  await expect(prefs.getByText('4 days')).toBeVisible();
  await expect(prefs.getByText('November')).toBeVisible();
  await expect(prefs.getByText('Budget-friendly')).toBeVisible();

  // 3. Results
  await expect(page.getByRole('heading', { name: /I found \d+ trips matching your preferences/ })).toBeVisible({ timeout: 10_000 });
  await expect(page.locator('.travel-card').first()).toBeVisible();
  await page.getByRole('button', { name: /Agent activity/ }).click();
  await expect(page.getByText('Identified suitable destinations').last()).toBeVisible();

  // 4. Conversational refinement keeps context
  await page.getByLabel('Refine your search').fill('Make it cheaper and closer to the beach.');
  await page.getByLabel('Refine your search').press('Enter');
  await expect(page.getByText(/I've updated your search/)).toBeVisible({ timeout: 10_000 });
  await expect(prefs.getByText('Under £400')).toBeVisible();
  await expect(prefs.getByText('Beach within 1 km')).toBeVisible();
  await expect(prefs.getByText('November')).toBeVisible();
  await expect(page.getByRole('heading', { name: /I found 6 trips/ })).toBeVisible();

  // 5. Trip details
  await page.locator('.travel-card', { hasText: 'Tenerife' }).first().getByRole('button', { name: /View trip/ }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Tenerife' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Why this matches' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Sample itinerary' })).toBeVisible();

  // 6. Ask AI about this trip
  await page.getByRole('button', { name: 'Is this suitable for a couple?' }).click();
  await expect(page.getByText(/is a good fit for a couple/)).toBeVisible();

  // Back to results keeps the conversation
  await page.getByRole('button', { name: 'Back to results' }).click();
  await expect(page.getByText('Make it cheaper and closer to the beach.')).toBeVisible();

  // 7. Engineering page
  await page.goto('/#/engineering');
  await expect(page.getByRole('heading', { name: 'Engineering behind the experience' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'How this prototype maps to the role' })).toBeVisible();
});

test('filters and conversation share the same search state', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Find a family-friendly beach holiday' }).click();
  await expect(page.getByRole('heading', { name: /I found \d+ trips/ })).toBeVisible({ timeout: 10_000 });
  await page.getByRole('button', { name: 'Filters' }).click();
  await page.getByLabel('Budget (per person)').selectOption('400');
  await page.getByRole('button', { name: 'Apply filters' }).click();
  const prefs = page.getByRole('list', { name: 'Your current preferences' });
  await expect(prefs.getByText('Under £400')).toBeVisible();
  await expect(prefs.getByText('Family-friendly')).toBeVisible();
  // Removing a chip re-runs the search
  await prefs.getByRole('button', { name: 'Remove Under £400' }).click();
  await expect(prefs.getByText('Under £400')).toHaveCount(0);
});

test('no-result search offers a way to broaden', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Describe the trip you want').fill('Find a beach holiday for under £200');
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { name: 'I couldn’t find an exact match.' })).toBeVisible({ timeout: 10_000 });
  await page.getByRole('button', { name: /Increase budget to £300/ }).first().click();
  await expect(page.getByRole('heading', { name: /I found \d+ trips?/ })).toBeVisible({ timeout: 10_000 });
});

test('invalid input gets a helpful message, empty input is blocked', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Search' }).click();
  await expect(page.getByRole('alert')).toContainText('Tell us a little about the trip');
  await page.getByLabel('Describe the trip you want').fill('asdf qwerty');
  await page.getByRole('button', { name: 'Search' }).click();
  await expect(page.getByText(/couldn't understand that request/)).toBeVisible({ timeout: 10_000 });
});

test('keyboard users can search and open a trip', async ({ page, isMobile }) => {
  test.skip(isMobile, 'keyboard journey is desktop only');
  await page.goto('/');
  await page.keyboard.type('Somewhere warm with good nightlife');
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { name: /I found \d+ trips/ })).toBeVisible({ timeout: 10_000 });
  const viewButton = page.getByRole('button', { name: /View trip/ }).first();
  await viewButton.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { name: 'Why this matches' })).toBeVisible();
});
