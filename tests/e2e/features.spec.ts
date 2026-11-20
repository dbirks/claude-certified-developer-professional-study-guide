import { expect, test, type Locator, type Page } from '@playwright/test';
import { panel, skipUnlessProject, type TouchPoint } from './helpers';

/* ------------------------------------------------------------------ helpers */

/** A finger that is down on the page: CDP touchStart, incremental touchMoves, touchEnd. */
type TouchHold = {
  moveTo: (x: number) => Promise<void>;
  release: () => Promise<void>;
};

async function touchHold(page: Page, at: TouchPoint, y?: number): Promise<TouchHold> {
  const cdp = await page.context().newCDPSession(page);
  const startY = y ?? at.y;
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [{ x: at.x, y: startY }],
  });
  return {
    async moveTo(x: number) {
      await cdp.send('Input.dispatchTouchEvent', {
        type: 'touchMove',
        touchPoints: [{ x, y: startY }],
      });
    },
    async release() {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      await cdp.detach();
    },
  };
}

/** Drag `from` → `to` in `step` px increments and read the drawer state just before touchEnd. */
async function dragInSteps(
  page: Page,
  from: number,
  to: number,
  step: number,
): Promise<{ dragging: boolean; inlineTransform: string; translatePx: number; backdropOpacity: number; state: string }> {
  const drag = await touchHold(page, { x: from, y: 400 });
  try {
    const direction = to > from ? 1 : -1;
    for (let x = from + direction * step; direction > 0 ? x <= to : x >= to; x += direction * step) {
      await drag.moveTo(x);
    }
    if (from + direction * step !== to) await drag.moveTo(to);
    return await page.evaluate(() => {
      const panel = document.getElementById('toc-panel') as HTMLElement | null;
      const backdrop = document.getElementById('toc-backdrop') as HTMLElement | null;
      const inline = panel?.style.transform ?? '';
      const matched = /translateX\((-?[0-9.]+)px\)/.exec(inline);
      return {
        dragging: Boolean(panel?.classList.contains('is-dragging')),
        inlineTransform: inline,
        translatePx: matched ? Number.parseFloat(matched[1]!) : Number.NaN,
        backdropOpacity: backdrop ? Number.parseFloat(getComputedStyle(backdrop).opacity) : Number.NaN,
        state: panel?.dataset.state ?? '',
      };
    });
  } finally {
    await drag.release();
  }
}

/** Wait for the 200ms slide-in / 210ms spring-back to settle (mirrors helpers.openDrawer). */
async function expectPanelSettledOpen(page: Page): Promise<void> {
  await page
    .waitForFunction(
      () => {
        const el = document.getElementById('toc-panel');
        if (!el) return false;
        const r = el.getBoundingClientRect();
        return Math.abs(r.right - r.width) < 1 && getComputedStyle(el).transform === 'none';
      },
      undefined,
      { timeout: 5_000 },
    )
    .catch(() => undefined);
}

/** Tap on mobile (matches the drawer specs), plain click elsewhere. */
async function press(page: Page, locator: Locator): Promise<void> {
  if (test.info().project.name === 'mobile') {
    await locator.scrollIntoViewIfNeeded();
    const box = await locator.boundingBox();
    expect(box, `${await locator.evaluate((el) => el.className)} visible`).not.toBeNull();
    await page.touchscreen.tap(box!.x + box!.width / 2, box!.y + box!.height / 2);
  } else {
    await locator.click();
  }
}

const studiedText = (page: Page) => page.locator('.study-progress');
const studyLabel = (page: Page) => page.locator('.study-toggle__label');

/* ----------------------------------------------------------------- scenario 1 */

test('drag-to-close tracks the finger, springs back short, commits long', async ({ page }) => {
  skipUnlessProject('mobile');
  await page.goto('.');

  await page.evaluate(() => window.__ccdvpDrawer?.open());
  await expect(panel(page)).toHaveAttribute('data-state', 'open');
  await expectPanelSettledOpen(page);

  // Short drag on the backdrop (370 → 280 = 90px left, under the 30% commit threshold).
  const short = await dragInSteps(page, 370, 280, 5);
  expect(short.state, 'drawer stays open while dragging').toBe('open');
  expect(short.dragging, 'panel gets is-dragging while the finger moves').toBe(true);
  expect(short.translatePx, `inline transform was ${short.inlineTransform}`).toBeLessThan(0);
  // CDP may coalesce the last touchMove, so allow a few px of lag behind the finger.
  expect(Math.abs(short.translatePx - -90), `inline transform was ${short.inlineTransform}`).toBeLessThanOrEqual(10);
  expect(short.backdropOpacity, 'backdrop fades with the drag').toBeLessThan(1);
  expect(short.backdropOpacity).toBeGreaterThan(0);

  // Release under the threshold: state springs back to open.
  await expect(panel(page)).toHaveAttribute('data-state', 'open');
  await expect(panel(page)).not.toHaveClass(/is-dragging/);
  await expectPanelSettledOpen(page);
  await expect
    .poll(() => page.evaluate(() => getComputedStyle(document.getElementById('toc-backdrop')!).opacity))
    .toBe('1');

  // Long drag starting on the panel itself (200 → 40 = 160px left, past 30% of 335px).
  const long = await dragInSteps(page, 200, 40, 5);
  expect(long.dragging, 'the second drag tracks too').toBe(true);
  expect(Math.abs(long.translatePx - -160), `inline transform was ${long.inlineTransform}`).toBeLessThanOrEqual(10);
  await expect(panel(page)).toHaveAttribute('data-state', 'closed', { timeout: 5_000 });
  await expect(panel(page)).not.toHaveClass(/is-dragging/);
  await expect(page.locator('#toc-toggle')).toHaveAttribute('aria-expanded', 'false');
});

/* ----------------------------------------------------------------- scenario 2 */

test('mark as studied persists and feeds the home progress line', async ({ page }) => {
  skipUnlessProject('mobile');
  const chapter = 'production-integration/reliability/';

  await page.goto(chapter);
  const btn = page.locator('.study-toggle__btn');
  await expect(btn).toHaveAttribute('aria-pressed', 'false');
  await press(page, btn);

  await expect(btn).toHaveAttribute('aria-pressed', 'true');
  await expect(studyLabel(page)).toHaveText('Studied');
  await expect
    .poll(() => page.evaluate(() => localStorage.getItem('ccdvp:studied:v1')))
    .toBe('["2.1"]');

  // Survives a reload.
  await page.reload();
  await expect(page.locator('.study-toggle__btn')).toHaveAttribute('aria-pressed', 'true');
  await expect(studyLabel(page)).toHaveText('Studied');

  // Home hero counts it.
  await page.goto('.');
  await expect(studiedText(page)).toBeVisible();
  await expect(studiedText(page)).toContainText('1 of 25');

  // Toggle back off.
  await page.goto(chapter);
  await press(page, page.locator('.study-toggle__btn'));
  await expect(page.locator('.study-toggle__btn')).toHaveAttribute('aria-pressed', 'false');
  await expect(studyLabel(page)).toHaveText('Mark as studied');

  await page.goto('.');
  const visible = await studiedText(page).isVisible();
  if (visible) {
    await expect(studiedText(page)).toContainText('0 of 25');
  } else {
    await expect(studiedText(page)).toBeHidden();
  }
});

/* ----------------------------------------------------------------- scenario 3 */

test('search domain filter chip narrows results to one domain', async ({ page }) => {
  skipUnlessProject('desktop');
  await page.goto('.');

  await page.click('#search-open');
  const input = page.locator('#search-root input');
  await expect(input, 'pagefind UI lazy-loads').toBeVisible({ timeout: 20_000 });

  await input.fill('retry');
  const results = page.locator('.pagefind-ui__result');
  await expect(results.first(), 'results for "retry"').toBeVisible({ timeout: 20_000 });

  const filterPanel = page.locator('.pagefind-ui__filter-panel');
  await expect(filterPanel, 'domain chip row').toBeVisible();

  const chip = filterPanel.locator('.pagefind-ui__filter-value', { hasText: 'Production Integration' });
  await expect(chip, 'Production Integration chip shows for these hits').toBeVisible();
  const unfiltered = await results.count();

  await chip.click(); // the transparent checkbox covers the whole pill

  await expect(results.first(), 'still some hits after filtering').toBeVisible({ timeout: 20_000 });
  await expect
    .poll(
      async () => {
        const hrefs = await results.locator('a[href]').evaluateAll((els) =>
          els.map((el) => (el as HTMLAnchorElement).getAttribute('href') ?? ''),
        );
        return hrefs.filter((href) => !href.includes('production-integration')).length;
      },
      { timeout: 15_000, message: 'results outside production-integration survived the filter' },
    )
    .toBe(0);

  const filtered = await results.count();
  expect(filtered, 'filter narrowed the result set').toBeLessThanOrEqual(unfiltered);
  expect(await chip.getAttribute('class')).toContain('pagefind-ui__filter-value--checked');
});
