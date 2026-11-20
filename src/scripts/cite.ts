// Tap-to-open citation sheet (frame 3c). See docs/ARCHITECTURE.md §Components in MDX + §Citations data.
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

const MATCH_LABEL: Record<string, string> = {
  ok: 'Quote matches page',
  'ok-loose': 'Quote closely matches',
};

const byId = <T extends Element>(id: string): T | null => document.getElementById(id) as T | null;
const textOf = (el: Element | null): string => (el?.textContent ?? '').replace(/\s+/g, ' ').trim();

/** The source list is collapsed by default, so jumps to it must expand it first. */
const SOURCES_HASH = /^#(sources|src-[\w:.-]+)$/;
const sourcesId = (hash: string): string => (SOURCES_HASH.test(hash) ? decodeURIComponent(hash.slice(1)) : '');

/** Element rendered and near the top of the viewport (a row inside a closed <details> has no box). */
function landedOnTarget(el: Element): boolean {
  const rect = el.getBoundingClientRect();
  return rect.height > 0 && rect.top >= 0 && rect.top < window.innerHeight * 0.85;
}

/** "Supports: " lives in an .sr-only span and a ::before; we render our own label in the sheet. */
function supportsText(li: HTMLElement): string {
  const claim = li.querySelector('.source__claim');
  if (!claim) return '';
  const clone = claim.cloneNode(true) as HTMLElement;
  clone.querySelector('.sr-only')?.remove();
  return textOf(clone).replace(/^Supports:\s*/i, '').trim();
}

/** Copy one source row into the sheet. */
function fillPop(pop: HTMLElement, li: HTMLElement): void {
  const title = li.querySelector('.source__title');
  const quote = li.querySelector('.source__quote');
  const meta = li.querySelector('.source__meta');
  const host = li.querySelector('.source__host');
  const tag = li.querySelector('.source__tag');
  const num = li.querySelector('.source__n');
  const href = title instanceof HTMLAnchorElement ? title.href : '';
  const match = li.dataset.match ?? '';

  pop.dataset.tag = li.dataset.tag ?? '';

  const titleEl = byId<HTMLElement>('cite-pop-title');
  const openEl = byId<HTMLElement>('cite-pop-open');
  const quoteEl = byId<HTMLElement>('cite-pop-quote');
  const metaEl = byId<HTMLElement>('cite-pop-meta');
  const numEl = byId<HTMLElement>('cite-pop-n');
  const tagEl = byId<HTMLElement>('cite-pop-tag');
  const matchEl = byId<HTMLElement>('cite-pop-match');
  const matchTextEl = byId<HTMLElement>('cite-pop-match-text');
  const supportsEl = byId<HTMLElement>('cite-pop-supports');
  const supportsTextEl = byId<HTMLElement>('cite-pop-supports-text');
  const jumpEl = byId<HTMLElement>('cite-pop-jump');

  if (titleEl) {
    titleEl.textContent = textOf(title) || 'Source';
    if (titleEl instanceof HTMLAnchorElement && href) titleEl.href = href;
  }
  if (openEl instanceof HTMLAnchorElement && href) openEl.href = href;
  if (quoteEl) quoteEl.textContent = textOf(quote);
  if (numEl) numEl.textContent = textOf(num);

  if (tagEl) {
    const label = textOf(tag);
    tagEl.textContent = label;
    tagEl.dataset.tag = li.dataset.tag ?? '';
    tagEl.hidden = !label;
  }

  if (matchEl && matchTextEl) {
    const label = MATCH_LABEL[match] ?? '';
    matchTextEl.textContent = label;
    matchEl.hidden = !label;
  }

  if (supportsEl && supportsTextEl) {
    const claim = supportsText(li);
    supportsTextEl.textContent = claim;
    supportsEl.hidden = !claim;
  }

  // Meta line: "{host} · accessed {date}[ · version note]" — the row already carries that copy.
  if (metaEl) {
    const hostName = textOf(host);
    const row = textOf(meta);
    const tail = (hostName && row.startsWith(hostName) ? row.slice(hostName.length) : row).trim();
    const rest = tail.replace(/^·\s*/, '').replace(/\bAccessed\b/, 'accessed');
    metaEl.textContent = [hostName, rest].filter(Boolean).join(' · ');
  }

  if (jumpEl) {
    const count = document.querySelectorAll('li.source').length;
    jumpEl.textContent = count ? `All ${count} sources` : 'All sources';
    jumpEl.hidden = count === 0;
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
  const pop = byId<HTMLElement>('cite-pop');
  if (!pop) return;
  const backdrop = byId<HTMLElement>('cite-backdrop');
  const closeBtn = pop.querySelector<HTMLButtonElement>('.cite-pop__close');
  const jumpEl = pop.querySelector<HTMLElement>('.cite-pop__jump');
  if (!jumpEl) return;

  let activeLink: HTMLAnchorElement | null = null;
  let openLinkTop = 0; // viewport Y of the citation when the card was anchored to it
  let touchStartY: number | null = null;

  /* ------------------------------------------------- collapsed source list */

  const sources = document.querySelector<HTMLDetailsElement>('section.sources details.sources__details');

  /** Expand the list, then scroll to the heading or one of its rows. */
  const goToSources = (id: string, opts: { smooth?: boolean; onlyIfMissing?: boolean } = {}): void => {
    if (sources && !sources.open) sources.open = true;
    const el = document.getElementById(id);
    if (!el) return;
    if (opts.onlyIfMissing && landedOnTarget(el)) return; // the browser already landed there
    el.scrollIntoView({
      behavior: opts.smooth && !reducedMotion() ? 'smooth' : 'auto',
      block: 'start',
    });
  };

  /** Same-document link to #sources / #src-F12 (the sheet's own jump button is a <button>). */
  const sourcesLinkIn = (node: Element): HTMLAnchorElement | null => {
    const anchor = node.closest<HTMLAnchorElement>('a[href]');
    if (!anchor) return null;
    const target = new URL(anchor.href, location.href);
    if (target.pathname !== location.pathname || target.search !== location.search) return null;
    return sourcesId(target.hash) ? anchor : null;
  };

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
    if (backdrop) {
      backdrop.hidden = true;
      backdrop.classList.remove('cite-backdrop--show');
    }
    clearActive();
    const refocus =
      reason === 'key' || reason === 'button' || reason === 'swipe' || (reason === 'outside' && (focusInside || link === document.activeElement));
    if (refocus && link?.isConnected) link.focus({ preventScroll: true });
  };

  const open = (link: HTMLAnchorElement, li: HTMLElement): void => {
    clearActive();
    fillPop(pop, li);
    if (backdrop) {
      backdrop.hidden = !isMobile();
      backdrop.classList.add('cite-backdrop--show');
    }
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

    const sourcesAnchor = sourcesLinkIn(target);
    if (sourcesAnchor) {
      // Deep link into the collapsed list: expand it before the page jumps (no navigation here,
      // we do the scrolling ourselves so the row is laid out first).
      ev.preventDefault();
      if (!pop.hidden) close('silent');
      const id = sourcesId(new URL(sourcesAnchor.href, location.href).hash);
      if (location.hash !== `#${id}`) history.pushState(null, '', `#${id}`);
      goToSources(id, { smooth: true });
      return;
    }

    if (pop.hidden || pop.contains(target)) return;
    close('outside'); // includes taps on #cite-backdrop (a sibling of the sheet)
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
    if (pop.hidden || !activeLink) return;
    if (backdrop) backdrop.hidden = !isMobile();
    layoutCard(pop, activeLink);
    openLinkTop = activeLink.getBoundingClientRect().top;
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
    goToSources('sources', { smooth: true });
  });

  // #sources / #src-F12 can also arrive from the on-page rail, a search result, the back button
  // or a pasted URL: the list has to be open before such a jump can land.
  window.addEventListener('hashchange', () => {
    const id = sourcesId(location.hash);
    if (id) goToSources(id, { smooth: true, onlyIfMissing: true });
  });
  const initialId = sourcesId(location.hash);
  if (initialId) {
    if (sources) sources.open = true;
    // Wait one frame so the revealed rows are laid out before the jump.
    window.requestAnimationFrame(() => goToSources(initialId, { onlyIfMissing: true }));
  }

  // Client-side navigation (if any) must not leave a stale popover behind.
  window.addEventListener('ccdvp:navigate', () => close('silent'));
}
