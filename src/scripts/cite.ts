// Tap-to-open citation popovers. See docs/ARCHITECTURE.md §Components in MDX + §Citations data.
// All content comes from the chapter's own source list (`#src-F3` rendered by SourceList.astro),
// so there is no second data path to keep in sync.
const MOBILE_QUERY = '(max-width: 639.98px)';
const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';
const CARD_MAX_WIDTH = 440;
const VIEWPORT_EDGE = 12;
const CARD_GAP = 8;
const SWIPE_CLOSE_PX = 60;
const SCROLL_CLOSE_PX = 200;

type CloseReason = 'key' | 'button' | 'swipe' | 'outside' | 'silent';

const matches = (query: string): boolean => window.matchMedia(query).matches;
const isMobile = (): boolean => matches(MOBILE_QUERY);
const reducedMotion = (): boolean => matches(REDUCED_MOTION_QUERY);

/** Copy one source row into the popover. */
function fillPop(pop: HTMLElement, li: HTMLElement): void {
  const title = li.querySelector('.source__title');
  const quote = li.querySelector('.source__quote');
  const meta = li.querySelector('.source__meta');
  const tag = li.querySelector('.source__tag');
  const num = li.querySelector('.source__n');
  const href = title instanceof HTMLAnchorElement ? title.href : '';

  pop.dataset.tag = li.dataset.tag ?? '';

  const titleEl = document.getElementById('cite-pop-title');
  const openEl = document.getElementById('cite-pop-open');
  const quoteEl = document.getElementById('cite-pop-quote');
  const metaEl = document.getElementById('cite-pop-meta');
  const numEl = document.getElementById('cite-pop-n');

  if (titleEl) {
    titleEl.textContent = (title?.textContent ?? 'Source').trim();
    if (titleEl instanceof HTMLAnchorElement && href) titleEl.href = href;
  }
  if (openEl instanceof HTMLAnchorElement && href) openEl.href = href;
  if (quoteEl) quoteEl.textContent = (quote?.textContent ?? '').trim();
  if (numEl) numEl.textContent = (num?.textContent ?? '').trim();
  if (metaEl) {
    metaEl.textContent = [tag?.textContent?.trim(), meta?.textContent?.trim()]
      .filter((part): part is string => Boolean(part))
      .join(' · ');
  }
}

/** Desktop: anchor the card to the citation, clamped to the viewport. Mobile: CSS owns the geometry. */
function layoutCard(pop: HTMLElement, link: HTMLAnchorElement): void {
  if (isMobile()) {
    pop.style.left = '';
    pop.style.top = '';
    pop.style.width = '';
    return;
  }
  const width = Math.min(CARD_MAX_WIDTH, window.innerWidth - VIEWPORT_EDGE * 2);
  pop.style.width = `${width}px`;
  const rect = link.getBoundingClientRect();
  const height = pop.offsetHeight;

  let top = rect.bottom + CARD_GAP;
  if (top + height > window.innerHeight - VIEWPORT_EDGE) {
    const above = rect.top - height - CARD_GAP;
    top = above >= VIEWPORT_EDGE ? above : Math.max(VIEWPORT_EDGE, window.innerHeight - height - VIEWPORT_EDGE);
  }
  const maxLeft = Math.max(VIEWPORT_EDGE, window.innerWidth - width - VIEWPORT_EDGE);
  const left = Math.min(Math.max(rect.left, VIEWPORT_EDGE), maxLeft);

  pop.style.top = `${Math.round(top)}px`;
  pop.style.left = `${Math.round(left)}px`;
}

export function initCitations(): void {
  const pop = document.getElementById('cite-pop');
  if (!(pop instanceof HTMLElement)) return;
  const closeBtn = pop.querySelector<HTMLButtonElement>('.cite-pop__close');
  const jumpEl = pop.querySelector<HTMLElement>('.cite-pop__jump');
  if (!jumpEl) return;

  let activeLink: HTMLAnchorElement | null = null;
  let openLinkTop = 0; // viewport Y of the citation when the card was anchored to it
  let touchStartY: number | null = null;

  const clearActive = (): void => {
    if (!activeLink) return;
    activeLink.classList.remove('is-open');
    activeLink.removeAttribute('aria-expanded');
    activeLink = null;
  };

  const close = (reason: CloseReason): void => {
    if (pop.hidden) {
      clearActive();
      return;
    }
    const link = activeLink;
    const focusInside = pop.contains(document.activeElement);
    pop.hidden = true;
    pop.classList.remove('cite-pop--open');
    clearActive();
    const refocus =
      reason === 'key' || reason === 'button' || reason === 'swipe' || (reason === 'outside' && (focusInside || link === document.activeElement));
    if (refocus && link?.isConnected) link.focus({ preventScroll: true });
  };

  const open = (link: HTMLAnchorElement, li: HTMLElement): void => {
    clearActive();
    fillPop(pop, li);
    pop.hidden = false;
    pop.classList.add('cite-pop--open');
    activeLink = link;
    link.classList.add('is-open');
    link.setAttribute('aria-expanded', 'true');
    layoutCard(pop, link);
    openLinkTop = link.getBoundingClientRect().top;
    document.getElementById('cite-pop-title')?.focus({ preventScroll: true });
  };

  const citeLinkFrom = (node: EventTarget | null): HTMLAnchorElement | null => {
    const el = node instanceof Element ? node : null;
    return el?.closest<HTMLAnchorElement>('a.cite') ?? null;
  };

  /** The source row for a citation link, or null when this page has no matching entry. */
  const rowFor = (link: HTMLAnchorElement): HTMLElement | null => {
    const id = link.dataset.cite;
    return id ? document.getElementById(`src-${id}`) : null;
  };

  document.addEventListener('click', (ev) => {
    const target = ev.target instanceof Element ? ev.target : null;
    if (!target) return;

    const link = citeLinkFrom(target);
    if (link) {
      const li = rowFor(link);
      if (!li) return; // no source row on this page: plain anchor navigation instead
      ev.preventDefault();
      if (link === activeLink && !pop.hidden) {
        close('button');
        return;
      }
      open(link, li);
      return;
    }

    if (pop.hidden || pop.contains(target)) return;
    close('outside');
  });

  document.addEventListener('keydown', (ev) => {
    if (ev.key === 'Escape') {
      if (!pop.hidden) {
        ev.preventDefault();
        close('key');
      }
      return;
    }
    // role="button" on an <a>: Space must activate it instead of scrolling the page.
    if (ev.key !== ' ' && ev.code !== 'Space') return;
    const link = citeLinkFrom(ev.target);
    if (!link || !rowFor(link)) return;
    ev.preventDefault();
    link.click();
  });

  window.addEventListener('resize', () => {
    if (!pop.hidden && activeLink) {
      layoutCard(pop, activeLink);
      openLinkTop = activeLink.getBoundingClientRect().top;
    }
  });

  // The card stays put on screen, so dismiss it once its citation has drifted far away.
  window.addEventListener(
    'scroll',
    () => {
      if (pop.hidden || !activeLink || isMobile()) return;
      if (Math.abs(activeLink.getBoundingClientRect().top - openLinkTop) > SCROLL_CLOSE_PX) close('outside');
    },
    { passive: true },
  );

  // Bottom sheet: swipe down (when already at the top of its own scroll area) dismisses it.
  pop.addEventListener(
    'touchstart',
    (ev) => {
      touchStartY = ev.touches[0]?.clientY ?? null;
    },
    { passive: true },
  );
  pop.addEventListener(
    'touchend',
    (ev) => {
      const startY = touchStartY;
      touchStartY = null;
      if (startY === null || !isMobile()) return;
      const endY = ev.changedTouches[0]?.clientY ?? startY;
      if (endY - startY > SWIPE_CLOSE_PX && pop.scrollTop <= 0) close('swipe');
    },
    { passive: true },
  );

  closeBtn?.addEventListener('click', (ev) => {
    ev.stopPropagation();
    close('button');
  });

  jumpEl.addEventListener('click', (ev) => {
    ev.preventDefault();
    ev.stopPropagation();
    close('silent');
    document.getElementById('sources')?.scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth', block: 'start' });
  });

  // Client-side navigation (if any) must not leave a stale popover behind.
  window.addEventListener('ccdvp:navigate', () => close('silent'));
}
