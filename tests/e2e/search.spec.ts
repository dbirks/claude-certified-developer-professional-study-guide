import { expect, test } from '@playwright/test';
import { skipUnlessProject } from './helpers';

test('search finds the demo page and the result navigates under the subpath', async ({ page }) => {
  skipUnlessProject('desktop');
  await page.goto('.');

  await page.click('#search-open');
  const input = page.locator('#search-root input');
  await expect(input, 'pagefind UI must lazy-load under the subpath').toBeVisible({
    timeout: 20_000,
  });

  await input.fill('backoff');
  const result = page.locator('.pagefind-ui__result').first();
  await expect(result, 'pagefind must return results for "backoff"').toBeVisible({
    timeout: 20_000,
  });

  await result.locator('a[href]').first().click();

  // Must have left the home page for a chapter page under the deploy base.
  await expect(page).toHaveURL(/\/ccdvp-test\/[a-z0-9-]/, { timeout: 15_000 });
  await expect(page.locator('h1')).toBeVisible();
  expect(new URL(page.url()).pathname.startsWith('/ccdvp-test/')).toBe(true);
});
