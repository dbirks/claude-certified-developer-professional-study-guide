import { expect, test } from '@playwright/test';
import { openDrawer, skipUnlessProject } from './helpers';

test('TOC click closes the drawer, updates the hash, and scrolls the heading into view', async ({
  page,
}) => {
  skipUnlessProject('mobile');
  await page.goto('reference/component-demo/');

  await openDrawer(page);
  await page.locator('[data-toc-id="c-component-demo--callouts-and-exam-lens"] .toc__link').click();

  await expect(page.locator('#toc-panel')).toHaveAttribute('data-state', 'closed');
  await expect.poll(() => page.evaluate(() => location.hash)).toBe('#callouts-and-exam-lens');

  const headingTop = () =>
    page.locator('#callouts-and-exam-lens').evaluate((el) => el.getBoundingClientRect().top);
  await expect
    .poll(async () => {
      const y = await headingTop();
      return y >= 40 && y <= 200;
    }, { timeout: 8000, message: '#callouts-and-exam-lens never settled between 40px and 200px' })
    .toBe(true);
});
