/**
 * Mobile TOC drawer: slide-out panel below 1024px, opened by #toc-toggle or a swipe from the
 * left screen edge, closed by the X, the backdrop, Escape, navigation or a left drag on the
 * panel / backdrop. The closing drag tracks the finger: the panel slides under it, the backdrop
 * fades with the progress, and releasing past the threshold (or flicking left) commits the close
 * while anything else springs back. A tap on the backdrop closes immediately.
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
    backdrop.style.opacity = '';
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
    panel.classList.remove('is-springing');
    panel.style.transition = '';
    panel.style.transform = '';
    toggle.setAttribute('aria-expanded', 'false');
    // Dropping the drag's inline opacity and the is-visible class in the same task lets the
    // backdrop fade out from wherever the finger left it instead of jumping.
    backdrop.style.opacity = '';
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
  mobile.addEventListener('change', onBreakpoint);

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

  /* ------------------------------------------------ drag left to close (finger tracking) */

  const CLOSE_INTENT = 8; // px of movement before deciding horizontal vs vertical
  const CLOSE_RATIO = 1.2; // |dx| must beat |dy| by this much to count as a drag
  const CLOSE_COMMIT_RATIO = 0.3; // panel widths travelled (or a flick) commits the close
  const CLOSE_FLICK_VELOCITY = -0.35; // px per ms, leftward
  const FLICK_WINDOW = 80; // ms of trail the flick estimate looks back over
  const RUBBER_BAND_PX = 12; // max overscroll right of the open position
  const RUBBER_BAND_FACTOR = 0.15;
  const SPRING_BACK_MS = 210;

  let dragActive = false; // finger is down on the panel / backdrop while open
  let dragHorizontal = false; // intent decided: this is a close drag
  let dragStartX = 0;
  let dragStartY = 0;
  let dragDx = 0;
  let dragDy = 0;
  let trail: { t: number; x: number }[] = [];
  let springBackTimer: number | undefined;
  let swallowPanelClick = false; // the drag released over a link: kill the synthesised click

  /** 'panel' | 'backdrop' for a touch that started on one of the two drag surfaces, else null. */
  function dragSurface(target: EventTarget | null): 'panel' | 'backdrop' | null {
    if (!(target instanceof Element)) return null;
    if (target === backdrop || backdrop.contains(target)) return 'backdrop';
    if (target === panel || panel.contains(target)) return 'panel';
    return null;
  }

  function addSample(t: number, x: number): void {
    trail.push({ t, x });
    while (trail.length > 2 && t - trail[0].t > FLICK_WINDOW) trail.shift();
  }

  /** Average velocity over the freshest ~FLICK_WINDOW ms of the trail (negative = leftward). */
  function flickVelocity(): number {
    if (trail.length < 2) return 0;
    const last = trail[trail.length - 1];
    let first = last;
    for (const sample of trail) {
      if (last.t - sample.t <= FLICK_WINDOW) {
        first = sample;
        break;
      }
    }
    const dt = last.t - first.t;
    return dt > 0 ? (last.x - first.x) / dt : 0;
  }

  /** Move the panel to `shift` px (negative = left) and fade the backdrop by the same progress. */
  function setDragPosition(shift: number): void {
    panel.style.transform = `translateX(${shift}px)`;
    const progress = Math.max(0, Math.min(1, -shift / panelWidth));
    backdrop.style.opacity = String(1 - progress);
  }

  function dragTouchStart(event: TouchEvent): void {
    if (!open || !mobile.matches || event.touches.length !== 1) {
      dragActive = false;
      return;
    }
    if (!dragSurface(event.target)) {
      dragActive = false;
      return;
    }
    const touch = event.touches[0];
    dragActive = true;
    dragHorizontal = false;
    dragStartX = touch.clientX;
    dragStartY = touch.clientY;
    dragDx = 0;
    dragDy = 0;
    panelWidth = panel.getBoundingClientRect().width || panelWidth || 320;
    trail = [{ t: event.timeStamp || performance.now(), x: touch.clientX }];
  }

  function dragTouchMove(event: TouchEvent): void {
    if (!dragActive || !open) return;
    const touch = event.touches[0];
    if (!touch) return;
    dragDx = touch.clientX - dragStartX;
    dragDy = touch.clientY - dragStartY;
    addSample(event.timeStamp || performance.now(), touch.clientX);
    if (!dragHorizontal) {
      if (Math.abs(dragDx) <= CLOSE_INTENT && Math.abs(dragDy) <= CLOSE_INTENT) return;
      // Vertical (or rightward-first) intent: drop out and let the TOC list scroll natively.
      if (dragDx >= 0 || Math.abs(dragDx) <= CLOSE_RATIO * Math.abs(dragDy)) {
        dragActive = false;
        trail = [];
        return;
      }
      dragHorizontal = true;
      panel.classList.add('is-dragging');
      panel.style.transition = 'none';
    }
    setDragPosition(
      dragDx < 0 ? dragDx : Math.min(RUBBER_BAND_PX, dragDx * RUBBER_BAND_FACTOR),
    );
  }

  function dragTouchEnd(event: TouchEvent): void {
    if (!dragActive) return;
    dragActive = false;
    const touch = event.changedTouches[0];
    if (touch) {
      dragDx = touch.clientX - dragStartX;
      dragDy = touch.clientY - dragStartY;
      addSample(event.timeStamp || performance.now(), touch.clientX);
    }
    const startedOnBackdrop = dragSurface(event.target) === 'backdrop';
    const wasHorizontal = dragHorizontal;
    const flicked = flickVelocity() < CLOSE_FLICK_VELOCITY;
    dragHorizontal = false;
    trail = [];
    panel.classList.remove('is-dragging');
    panel.style.transition = '';

    if (!wasHorizontal) {
      // A tap (< 8px of movement) on the dimmed area closes right away; a tap on the panel is
      // left to the ordinary click handlers (X button, links).
      if (
        startedOnBackdrop &&
        Math.abs(dragDx) < CLOSE_INTENT &&
        Math.abs(dragDy) < CLOSE_INTENT
      ) {
        closeDrawer();
      }
      return;
    }

    const travelled = Math.min(0, dragDx);
    if (-travelled > CLOSE_COMMIT_RATIO * panelWidth || flicked) {
      // Release from the current position: closeDrawer() drops the inline transform, so the
      // panel slides out from translateX(dx) to the closed translateX(-100%) over the CSS 200ms.
      if (-travelled > RUBBER_BAND_PX) swallowPanelClick = true;
      closeDrawer();
      return;
    }

    // Spring back to open: the inline transform goes away, the panel eases home.
    panel.classList.add('is-springing');
    panel.style.transform = '';
    backdrop.style.opacity = '';
    window.clearTimeout(springBackTimer);
    springBackTimer = window.setTimeout(() => panel.classList.remove('is-springing'), SPRING_BACK_MS);
  }

  document.addEventListener('touchstart', dragTouchStart, { passive: true });
  document.addEventListener('touchmove', dragTouchMove, { passive: true });
  document.addEventListener('touchend', dragTouchEnd, { passive: true });
  document.addEventListener('touchcancel', dragTouchEnd, { passive: true });

  // Chrome may still synthesise a click for a short drag; never let it activate a TOC link.
  panel.addEventListener(
    'click',
    (event) => {
      if (!swallowPanelClick) return;
      swallowPanelClick = false;
      event.preventDefault();
      event.stopPropagation();
    },
    true,
  );
  document.addEventListener(
    'touchstart',
    () => {
      swallowPanelClick = false;
    },
    { capture: true, passive: true },
  );

  window.__ccdvpDrawer = { open: openDrawer, close: closeDrawer, isOpen };
}

declare global {
  interface Window {
    __ccdvpDrawer?: { open: () => void; close: () => void; isOpen: () => boolean };
  }
}
