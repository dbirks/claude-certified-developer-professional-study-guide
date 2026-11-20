import { expect, test, type Locator, type Page } from '@playwright/test';

export type TouchPoint = { x: number; y: number };

/** Dispatch a trusted touch swipe (touchStart → N × touchMove → touchEnd) over the viewport via CDP. */
export async function touchSwipe(page: Page, from: TouchPoint, to: TouchPoint, steps = 12): Promise<void> {
  const cdp = await page.context().newCDPSession(page);
  try {
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [{ x: from.x, y: from.y }],
    });
    for (let i = 1; i <= steps; i += 1) {
      const x = from.x + ((to.x - from.x) * i) / steps;
      const y = from.y + ((to.y - from.y) * i) / steps;
      await cdp.send('Input.dispatchTouchEvent', {
        type: 'touchMove',
        touchPoints: [{ x, y }],
      });
    }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  } finally {
    await cdp.detach();
  }
}

export const panel = (page: Page) => page.locator('#toc-panel');

export async function openDrawer(page: Page): Promise<void> {
  const toggle = page.locator('#toc-toggle');
  // After a close the backdrop lingers ~220ms and would swallow a raw tap on the toggle.
  await expect(page.locator('#toc-backdrop')).toBeHidden();
  if (test.info().project.name === 'mobile') {
    // A plain locator.click() runs DOM.scrollIntoViewIfNeeded first, which in mobile emulation
    // shifts the page scroll under the sticky topbar; a touch tap matches real-device UX anyway.
    const box = await toggle.boundingBox();
    expect(box, '#toc-toggle visible').not.toBeNull();
    await page.touchscreen.tap(box!.x + box!.width / 2, box!.y + box!.height / 2);
  } else {
    await toggle.click();
  }
  await expect(panel(page)).toHaveAttribute('data-state', 'open');
  // Wait for the 200ms slide-in to finish so touch targets land on the settled panel.
  await page
    .waitForFunction(() => {
      const el = document.getElementById('toc-panel');
      if (!el) return false;
      const r = el.getBoundingClientRect();
      return Math.abs(r.right - r.width) < 1 && getComputedStyle(el).transform === 'none';
    })
    .catch(() => undefined);
}

export async function expectDrawerClosed(page: Page): Promise<void> {
  await expect(panel(page)).toHaveAttribute('data-state', 'closed');
}

/** Viewport Y of an element's top edge (NaN when it has no box). */
export function elementTop(page: Page, selector: string): Promise<number> {
  return page.locator(selector).first().evaluate((el) => el.getBoundingClientRect().top);
}

/** Wait until the element's top sits in [min, max] viewport px (smooth scroll may take a beat). */
export async function expectTopBetween(page: Page, selector: string, min: number, max: number): Promise<void> {
  await expect
    .poll(
      async () => {
        const y = await elementTop(page, selector);
        return Number.isFinite(y) && y >= min && y <= max;
      },
      { timeout: 8000, message: `${selector} top never landed between ${min} and ${max}px` },
    )
    .toBe(true);
}

/** Skips the running test unless it belongs to the named project. Call at the top of the test body. */
export function skipUnlessProject(name: 'mobile' | 'desktop'): void {
  if (test.info().project.name !== name) test.skip(true, `runs in the ${name} project only`);
}

/** Collapse whitespace the way src/scripts/cite.ts does when it copies source text into the sheet. */
export function normalizeSpace(value: string | null | undefined): string {
  return (value ?? '').replace(/\s+/g, ' ').trim();
}

/** Normalized textContent of a locator ('' when it has no text). */
export async function normText(locator: Locator): Promise<string> {
  return normalizeSpace(await locator.textContent());
}

/** Instant scroll to the very bottom; reading.ts repaints the pill on the next animation frame. */
export async function scrollToBottom(page: Page): Promise<void> {
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
}

/** Wait until window.scrollY stops moving (smooth scroll finished), so position asserts are stable. */
export async function expectScrollSettled(page: Page): Promise<void> {
  let last = -1;
  let stable = 0;
  await expect
    .poll(
      async () => {
        const y = await page.evaluate(() => Math.round(window.scrollY));
        stable = y === last ? stable + 1 : 0;
        last = y;
        return stable >= 3; // ~300ms without movement (poll interval is 100ms)
      },
      { timeout: 12_000, message: 'page scroll never settled' },
    )
    .toBe(true);
}

/** Focus `#toc-toggle` by tabbing from the top of the document (never .focus() it directly). */
export async function tabToTocToggle(page: Page): Promise<void> {
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  for (let i = 0; i < 8; i += 1) {
    await page.keyboard.press('Tab');
    const id = await page.evaluate(() => document.activeElement?.id ?? '');
    if (id === 'toc-toggle') return;
  }
  throw new Error('never reached #toc-toggle by tabbing');
}
