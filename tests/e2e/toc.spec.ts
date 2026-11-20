import { expect, test } from '@playwright/test';
import { openDrawer, skipUnlessProject } from './helpers';

const d1Twisty = '[data-toc-id="d-1"] > .toc__row .toc__twisty';

test('collapse/expand choices persist across reloads (desktop)', async ({ page }) => {
  skipUnlessProject('desktop');
  await page.goto('.');

  // Expand domain 1 → survives a reload.
  await expect(page.locator(d1Twisty)).toHaveAttribute('aria-expanded', 'false');
  await page.locator(d1Twisty).click();
  await expect(page.locator(d1Twisty)).toHaveAttribute('aria-expanded', 'true');
  await page.reload();
  await expect(page.locator(d1Twisty)).toHaveAttribute('aria-expanded', 'true');

  // Collapse it again → also survives a reload.
  await page.locator(d1Twisty).click();
  await expect(page.locator(d1Twisty)).toHaveAttribute('aria-expanded', 'false');
  await page.reload();
  await expect(page.locator(d1Twisty)).toHaveAttribute('aria-expanded', 'false');

  // Collapse all: on the home page there is no active path, so nothing may stay expanded.
  await page.locator('[data-toc-action="collapse-all"]').click();
  const expanded = await page.locator('#toc-panel .toc__twisty[aria-expanded="true"]').count();
  expect(expanded).toBe(0);

  // Expand all: every depth-0 twisty is expanded afterwards.
  await page.locator('[data-toc-action="expand-all"]').click();
  const collapsedRoots = await page.locator(
    '#toc-panel [data-depth="0"] > .toc__row > .toc__twisty[aria-expanded="false"]',
  ).count();
  expect(collapsedRoots).toBe(0);
});

test('deep link to an H4 stays active after refresh', async ({ page }) => {
  await page.goto('reference/component-demo/#a-fourth-level-heading');
  await page.reload();

  if (test.info().project.name === 'mobile') {
    await openDrawer(page);
  }

  const link = page.locator(
    '[data-toc-id="c-component-demo--a-fourth-level-heading"] > .toc__row .toc__link',
  );
  await expect(link).toHaveClass(/is-active/);
  await expect(link).toBeVisible();
  await expect(
    page.locator('[data-toc-id="c-component-demo--error-handling-basics"]'),
  ).toHaveClass(/is-active-path/);

  await expect
    .poll(
      async () => {
        const y = await page.locator('#a-fourth-level-heading').evaluate((el) => el.getBoundingClientRect().top);
        return Number.isFinite(y) && y > 40 && y < 200;
      },
      { timeout: 8000, message: 'h4 never landed near the top of the viewport' },
    )
    .toBe(true);
});
