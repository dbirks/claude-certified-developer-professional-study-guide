import { expect, test } from '@playwright/test';

const DEMO_CITATION = 'Demo quote: replace with verified text.';

test('clicking a citation opens the popover with the matching source quote', async ({ page }) => {
  await page.goto('reference/component-demo/');

  const cite = page.locator('a.cite').first();
  await expect(cite).toHaveAttribute('data-cite', 'F1');
  await cite.click();

  const pop = page.locator('#cite-pop');
  await expect(pop).toBeVisible();

  const popQuote = (await pop.locator('#cite-pop-quote').textContent())?.trim() ?? '';
  const sourceQuote =
    (await page.locator('#src-F1 .source__quote').textContent())?.trim() ?? '';
  expect(popQuote.length).toBeGreaterThan(0);
  expect(popQuote).toBe(sourceQuote);
  expect(popQuote).toContain(DEMO_CITATION);

  if (test.info().project.name === 'mobile') {
    // Bottom sheet: the popover spans the full viewport width.
    const box = await pop.boundingBox();
    const width = await page.evaluate(() => window.innerWidth);
    expect(box).not.toBeNull();
    expect(Math.abs((box?.width ?? 0) - width)).toBeLessThanOrEqual(2);
  }

  await page.keyboard.press('Escape');
  await expect(pop).toBeHidden();
  await expect
    .poll(() =>
      page.evaluate(() => {
        const el = document.activeElement;
        return el instanceof HTMLElement && el.matches('a.cite') ? el.dataset.cite ?? '' : '';
      }),
    )
    .toBe('F1');
});
