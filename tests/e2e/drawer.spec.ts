import { expect, test } from '@playwright/test';
import { expectDrawerClosed, openDrawer, skipUnlessProject, tabToTocToggle, touchSwipe } from './helpers';

test('edge swipe opens the drawer; escape, backdrop and swipe-left close it', async ({ page }) => {
  skipUnlessProject('mobile');
  await page.goto('.');

  // Open: real touch events from the left edge, dragged inward.
  await touchSwipe(page, { x: 8, y: 400 }, { x: 200, y: 400 });
  await expect(page.locator('#toc-panel')).toHaveAttribute('data-state', 'open');
  await expect(page.locator('#toc-toggle')).toHaveAttribute('aria-expanded', 'true');

  // Close (a): Escape.
  await page.keyboard.press('Escape');
  await expectDrawerClosed(page);

  // Close (b): click the backdrop (right of the 335px panel).
  await openDrawer(page);
  await page.mouse.click(370, 400);
  await expectDrawerClosed(page);

  // Close (c): swipe left across the open panel.
  await openDrawer(page);
  await touchSwipe(page, { x: 250, y: 400 }, { x: 40, y: 400 });
  await expectDrawerClosed(page);
});

test('vertical scroll near the edge does not open the drawer', async ({ page }) => {
  skipUnlessProject('mobile');
  await page.goto('.');
  await touchSwipe(page, { x: 10, y: 600 }, { x: 14, y: 200 });
  await expectDrawerClosed(page);
  await expect(page.locator('#toc-panel')).not.toHaveClass(/is-dragging/);
  await expect(page.locator('#toc-toggle')).toHaveAttribute('aria-expanded', 'false');
});

test('keyboard only: open with Enter, focus stays trapped, Escape restores focus', async ({ page }) => {
  skipUnlessProject('mobile');
  await page.goto('.');

  await tabToTocToggle(page);
  await page.keyboard.press('Enter');
  await expect(page.locator('#toc-panel')).toHaveAttribute('data-state', 'open');

  const insidePanel = () =>
    page.evaluate(() => Boolean(document.activeElement?.closest?.('#toc-panel')));
  await expect.poll(insidePanel).toBe(true); // initial focus is inside the panel

  for (let i = 0; i < 30; i += 1) {
    await page.keyboard.press('Tab');
    expect(await insidePanel(), `focus escaped #toc-panel after ${i + 1} tabs`).toBe(true);
  }

  await page.keyboard.press('Escape');
  await expectDrawerClosed(page);
  await expect
    .poll(() => page.evaluate(() => document.activeElement?.id ?? ''))
    .toBe('toc-toggle');
});
