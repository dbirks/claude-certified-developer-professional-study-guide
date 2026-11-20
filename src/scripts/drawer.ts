/**
 * Mobile TOC drawer: slide-out panel below 1024px, opened by #toc-toggle or a swipe from the
 * left screen edge, closed by the X, the backdrop, Escape, navigation or a left swipe.
 * On desktop the panel is a static sidebar and everything here is inert.
 */

const MOBILE_QUERY = '(max-width: 1023.98px)';
const EDGE_ZONE = 28; // px from the left edge that may start an open swipe
const INTENT_THRESHOLD = 10; // px of movement before deciding direction
const COMMIT_DISTANCE = 50; // px needed to open/close without flick
const FLICK_VELOCITY = 0.4; // px per ms
const DIRECTION_RATIO = 1.5; // |dx| must beat |dy| by this much

export function initDrawer(): void {
  const panelEl = document.getElementById('toc-panel');
  const toggleEl = document.getElementById('toc-toggle');
  const backdropEl = document.getElementById('toc-backdrop');
  if (!panelEl || !toggleEl || !backdropEl) return;
  // Non-nullable bindings: TS does not carry the guards into the nested functions below.
  const panel: HTMLElement = panelEl;
  const toggle: HTMLElement = toggleEl;
  const backdrop: HTMLElement = backdropEl;
  const closeBtn = document.getElementById('toc-close');

  const mobile = matchMedia(MOBILE_QUERY);
  let open = false;
  let lastFocused: HTMLElement | null = null;
  let hideBackdropTimer: number | undefined;

  function isOpen(): boolean {
    return open;
  }

  function focusables(): HTMLElement[] {
    return Array.from(
      panel.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), summary, input, select, textarea, [tabindex]:not([tabindex="-1"])',
      ),
    ).filter((el) => !el.closest('[hidden]') && el.getClientRects().length > 0);
  }

  function openDrawer(): void {
    if (open || !mobile.matches) return;
    window.clearTimeout(hideBackdropTimer);
    open = true;
    lastFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    panel.dataset.state = 'open';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-modal', 'true');
    toggle.setAttribute('aria-expanded', 'true');
    backdrop.hidden = false;
    requestAnimationFrame(() => backdrop.classList.add('is-visible'));
    document.body.classList.add('scroll-locked');
    closeBtn?.focus({ preventScroll: true });
    const active =
      panel.querySelector<HTMLElement>('.toc__link.is-active') ??
      panel.querySelector<HTMLElement>('a.toc__link[aria-current="page"]');
    centerInPanel(active);
  }

  function closeDrawer(): void {
    if (!open) return;
    open = false;
    panel.dataset.state = 'closed';
    panel.removeAttribute('role');
    panel.removeAttribute('aria-modal');
    panel.classList.remove('is-dragging');
    panel.style.transform = '';
    toggle.setAttribute('aria-expanded', 'false');
    backdrop.classList.remove('is-visible');
    window.clearTimeout(hideBackdropTimer);
    hideBackdropTimer = window.setTimeout(() => {
      if (!open) backdrop.hidden = true;
    }, 220);
    document.body.classList.remove('scroll-locked');
    const target = lastFocused ?? toggle;
    if (target === toggle || document.contains(target)) target.focus({ preventScroll: true });
    lastFocused = null;
  }

  /** Scroll the panel (not the page) so `el` sits in the middle of the visible area. */
  function centerInPanel(el: HTMLElement | null): void {
    if (!el || !el.getClientRects().length) return;
    const rect = el.getBoundingClientRect();
    const panelRect = panel.getBoundingClientRect();
    panel.scrollTop += rect.top - panelRect.top - panelRect.height / 2 + rect.height / 2;
  }

  toggle.addEventListener('click', () => (open ? closeDrawer() : openDrawer()));
  closeBtn?.addEventListener('click', closeDrawer);
  backdrop.addEventListener('click', closeDrawer);
  document.addEventListener('ccdvp:navigate', () => closeDrawer());

  document.addEventListener('keydown', (event) => {
    if (!open) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      closeDrawer();
      return;
    }
    if (event.key !== 'Tab') return;
    const items = focusables();
    if (!items.length) return;
    const first = items[0];
    const last = items[items.length - 1];
    const current = document.activeElement;
    if (!panel.contains(current)) {
      event.preventDefault();
      first.focus();
    } else if (event.shiftKey && current === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && current === last) {
      event.preventDefault();
      first.focus();
    }
  });

  // Crossing the breakpoint while open: close cleanly rather than leave a modal sidebar.
  const onBreakpoint = () => {
    if (!mobile.matches) closeDrawer();
  };
  if (typeof mobile.addEventListener === 'function') mobile.addEventListener('change', onBreakpoint);
  else mobile.addListener(onBreakpoint);

  /* ------------------------------------------------------------ left-edge swipe */

  const BLOCK_SELECTOR = 'pre, table, .table-scroll, [data-no-swipe]';

  function inScrollableAncestor(target: EventTarget | null): boolean {
    let node: HTMLElement | null =
      target instanceof HTMLElement ? target : (target as Node | null)?.parentElement ?? null;
    while (node && node !== document.body) {
      if (node.matches?.(BLOCK_SELECTOR)) return true;
      if (node.scrollWidth > node.clientWidth + 1) {
        const overflowX = getComputedStyle(node).overflowX;
        if (overflowX === 'auto' || overflowX === 'scroll') return true;
      }
      node = node.parentElement;
    }
    return false;
  }

  let startX = 0;
  let startY = 0;
  let startT = 0;
  let dx = 0;
  let dy = 0;
  let tracking = false; // finger started in the edge zone while closed
  let horizontal = false; // intent decided
  let panelWidth = 0;

  document.addEventListener(
    'touchstart',
    (event: TouchEvent) => {
      if (open || !mobile.matches || event.touches.length !== 1) {
        tracking = false;
        return;
      }
      const touch = event.touches[0];
      if (touch.clientX > EDGE_ZONE || inScrollableAncestor(event.target)) {
        tracking = false;
        return;
      }
      tracking = true;
      horizontal = false;
      dx = 0;
      dy = 0;
      startX = touch.clientX;
      startY = touch.clientY;
      startT = event.timeStamp || performance.now();
      panelWidth = panel.getBoundingClientRect().width || 320;
    },
    { passive: true },
  );

  document.addEventListener(
    'touchmove',
    (event: TouchEvent) => {
      if (!tracking || open) return;
      const touch = event.touches[0];
      dx = touch.clientX - startX;
      dy = touch.clientY - startY;
      if (!horizontal) {
        if (Math.abs(dx) <= INTENT_THRESHOLD && Math.abs(dy) <= INTENT_THRESHOLD) return;
        horizontal = dx > 0 && Math.abs(dx) > DIRECTION_RATIO * Math.abs(dy);
        if (!horizontal) {
          tracking = false; // vertical scroll stays native
          return;
        }
      }
      const shift = Math.min(dx, panelWidth);
      panel.classList.add('is-dragging');
      panel.style.transition = 'none';
      panel.style.transform = `translateX(calc(-100% + ${shift}px))`;
    },
    { passive: true },
  );

  function endSwipe(event: TouchEvent): void {
    if (!tracking) return;
    tracking = false;
    const elapsed = Math.max(1, (event.timeStamp || performance.now()) - startT);
    const velocity = dx / elapsed;
    panel.classList.remove('is-dragging');
    panel.style.transition = '';
    panel.style.transform = '';
    if (!horizontal) return;
    horizontal = false;
    if (dx > COMMIT_DISTANCE || (velocity > FLICK_VELOCITY && dx > 20)) openDrawer();
  }

  document.addEventListener('touchend', endSwipe, { passive: true });
  document.addEventListener('touchcancel', endSwipe, { passive: true });

  /* --------------------------------------------------- swipe left to close */

  let closeStartX = 0;
  let closeStartY = 0;
  let closeDx = 0;
  let closeDy = 0;

  panel.addEventListener(
    'touchstart',
    (event: TouchEvent) => {
      if (!open || event.touches.length !== 1) return;
      closeStartX = event.touches[0].clientX;
      closeStartY = event.touches[0].clientY;
      closeDx = 0;
      closeDy = 0;
    },
    { passive: true },
  );

  panel.addEventListener(
    'touchend',
    (event: TouchEvent) => {
      if (!open) return;
      const changed = event.changedTouches[0];
      if (!changed) return;
      closeDx = changed.clientX - closeStartX;
      closeDy = changed.clientY - closeStartY;
      if (closeDx < -COMMIT_DISTANCE && Math.abs(closeDx) > DIRECTION_RATIO * Math.abs(closeDy)) closeDrawer();
    },
    { passive: true },
  );

  window.__ccdvpDrawer = { open: openDrawer, close: closeDrawer, isOpen };
}

declare global {
  interface Window {
    __ccdvpDrawer?: { open: () => void; close: () => void; isOpen: () => boolean };
  }
}
