/**
 * Nested TOC behavior. Markup contract: docs/ARCHITECTURE.md §TOC markup.
 *  - collapse/expand per node; explicit user choices persist in localStorage `ccdvp:toc:v1`
 *  - scroll-spy for the active heading: `.is-active` on its link, `.is-active-path` on ancestor items
 *  - same-page links use pushState + focus management and emit `ccdvp:navigate` (the drawer closes)
 */

const STORAGE_KEY = 'ccdvp:toc:v1';

type Choices = Record<string, boolean>;

function readChoices(): Choices {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    const out: Choices = {};
    for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof value === 'boolean') out[key] = value;
    }
    return out;
  } catch {
    return {};
  }
}

function writeChoice(id: string, value: boolean): void {
  try {
    const choices = readChoices();
    choices[id] = value;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(choices));
  } catch {
    /* storage unavailable (private mode): in-memory state still works */
  }
}

function prefersReducedMotion(): boolean {
  try {
    return matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

export function initToc(): void {
  const panelEl = document.getElementById('toc-panel');
  if (!panelEl) return;
  const panel: HTMLElement = panelEl; // non-nullable for the nested helpers below

  const currentId = document.body.dataset.currentId ?? '';
  const choices = readChoices();

  const items = Array.from(panel.querySelectorAll<HTMLElement>('.toc__item[data-toc-id]'));
  if (!items.length) return;
  const byId = new Map(items.map((li) => [li.dataset.tocId ?? '', li]));

  const childList = (li: HTMLElement) => li.querySelector<HTMLElement>(':scope > ul.toc__list');
  const twistyOf = (li: HTMLElement) => li.querySelector<HTMLButtonElement>(':scope > .toc__row > .toc__twisty');
  const linkOf = (li: HTMLElement) => li.querySelector<HTMLAnchorElement>(':scope > .toc__row > .toc__link');
  const labelOf = (li: HTMLElement) => linkOf(li)?.querySelector('.toc__label')?.textContent?.trim() || 'section';

  /** Ancestor toc items of `li`, outermost first, including `li` itself. */
  function chainOf(li: HTMLElement): HTMLElement[] {
    const chain: HTMLElement[] = [];
    let node: HTMLElement | null = li;
    while (node && node !== panel) {
      if (node.classList.contains('toc__item')) chain.unshift(node);
      node = node.parentElement;
    }
    return chain;
  }

  function isExpanded(li: HTMLElement): boolean {
    const ul = childList(li);
    return ul ? !ul.hidden : false;
  }

  function setExpanded(li: HTMLElement, expanded: boolean): void {
    const ul = childList(li);
    if (!ul) return;
    ul.hidden = !expanded;
    const button = twistyOf(li);
    if (button) {
      button.setAttribute('aria-expanded', String(expanded));
      button.setAttribute('aria-label', `${expanded ? 'Collapse' : 'Expand'} ${labelOf(li)}`);
    }
  }

  /** Stored choices are applied after the server-rendered state. */
  for (const [id, value] of Object.entries(choices)) {
    const li = byId.get(id);
    if (li && childList(li)) setExpanded(li, value);
  }

  /**
   * Item the user collapsed while it contained the active heading. Auto-expand skips it until the
   * active heading moves outside its subtree.
   */
  let suppressAutoExpand: string | null = null;

  /** Expand the path to `li` without writing to storage (scroll-driven auto-expand). */
  function expandChain(li: HTMLElement | null): void {
    if (!li) return;
    for (const node of chainOf(li)) {
      if ((node.dataset.tocId ?? '') === suppressAutoExpand) return;
      if (childList(node)) setExpanded(node, true);
    }
  }

  /** Drop suppression once it no longer hides something (expanded or no longer on the active path). */
  function refreshSuppression(): void {
    if (!suppressAutoExpand) return;
    const li = byId.get(suppressAutoExpand);
    if (!li || isExpanded(li)) suppressAutoExpand = null;
  }

  /* --------------------------------------------------------------- expansion UI */

  const expandableItems = items.filter((li) => childList(li));

  panel.addEventListener('click', (event) => {
    const target = event.target as HTMLElement | null;
    if (!target?.closest) return;

    const twisty = target.closest<HTMLButtonElement>('.toc__twisty');
    if (twisty && panel.contains(twisty)) {
      const li = twisty.closest<HTMLElement>('.toc__item');
      if (!li) return;
      const id = li.dataset.tocId ?? '';
      const next = !isExpanded(li);
      setExpanded(li, next);
      writeChoice(id, next);
      if (!next && activeChainIds.has(id)) suppressAutoExpand = id;
      else if (next && suppressAutoExpand === id) suppressAutoExpand = null;
      return;
    }

    const action = target.closest<HTMLElement>('[data-toc-action]');
    if (!action || !panel.contains(action)) return;
    const kind = action.dataset.tocAction;

    if (kind === 'collapse-all') {
      for (const li of expandableItems) {
        setExpanded(li, false);
        if (li.dataset.depth === '0') writeChoice(li.dataset.tocId ?? '', false);
      }
      const hiddenOnPath = activeChain ? chainOf(activeChain).find((node) => !isExpanded(node)) : undefined;
      suppressAutoExpand = hiddenOnPath?.dataset.tocId ?? null;
    } else if (kind === 'expand-current') {
      for (const li of expandableItems) setExpanded(li, false);
      suppressAutoExpand = null;
      expandChain(byId.get(activeId) ?? byId.get(currentId) ?? null);
    } else if (kind === 'expand-all') {
      for (const li of expandableItems) {
        const depth = Number(li.dataset.depth ?? 9);
        if (depth > 1) continue; // domains and chapters only
        setExpanded(li, true);
        if (depth === 0) writeChoice(li.dataset.tocId ?? '', true);
      }
      refreshSuppression();
    }
  });

  /* ------------------------------------------------------------ active heading */

  const onpageLinks = Array.from(document.querySelectorAll<HTMLElement>('.onpage a[data-onpage-link]'));
  let activeId = '';
  let activeChain: HTMLElement | null = null;
  let activeChainIds = new Set<string>();

  function clearActive(): void {
    panel.querySelectorAll('.toc__link.is-active').forEach((el) => el.classList.remove('is-active'));
    panel.querySelectorAll('.toc__item.is-active-path').forEach((el) => el.classList.remove('is-active-path'));
    onpageLinks.forEach((el) => el.classList.remove('is-active'));
  }

  function setActive(li: HTMLElement | null): void {
    const id = li?.dataset.tocId ?? '';
    if (id === activeId) return;
    if (suppressAutoExpand && li && !chainOf(li).some((node) => (node.dataset.tocId ?? '') === suppressAutoExpand)) {
      suppressAutoExpand = null;
    }
    clearActive();
    activeId = id;
    activeChain = li;
    activeChainIds = new Set(li ? chainOf(li).map((node) => node.dataset.tocId ?? '') : []);
    if (!li) return;
    expandChain(li);
    linkOf(li)?.classList.add('is-active');
    for (const node of chainOf(li)) {
      if (node !== li) node.classList.add('is-active-path');
    }
    const headingId = id.startsWith(`${currentId}--`) ? id.slice(currentId.length + 2) : '';
    if (headingId) mirrorOnpage(li);
    scrollLinkIntoPanel(linkOf(li));
  }

  /** Light the rail link for the active heading, or for the closest ancestor that has one. */
  function mirrorOnpage(li: HTMLElement): void {
    const prefix = `${currentId}--`;
    for (const node of chainOf(li).reverse()) {
      const nodeId = node.dataset.tocId ?? '';
      if (!nodeId.startsWith(prefix)) continue;
      const slug = nodeId.slice(prefix.length);
      const match = onpageLinks.find((el) => el.dataset.onpageLink === slug);
      if (match) {
        match.classList.add('is-active');
        return;
      }
    }
  }

  /** Scroll the TOC panel — never the page — just enough to keep `link` visible. */
  function scrollLinkIntoPanel(link: HTMLElement | null): void {
    if (!link || !link.getClientRects().length) return;
    const panelRect = panel.getBoundingClientRect();
    const rect = link.getBoundingClientRect();
    const pad = 8;
    let delta = 0;
    if (rect.top < panelRect.top + pad) delta = rect.top - panelRect.top - pad;
    else if (rect.bottom > panelRect.bottom - pad) {
      delta = Math.min(rect.bottom - panelRect.bottom + pad, Math.max(0, rect.top - panelRect.top - pad));
    }
    if (delta) panel.scrollTop += delta;
  }

  /** Headings of this chapter that have a TOC entry (chapter pages only). */
  const headingEls = currentId
    ? Array.from(document.querySelectorAll<HTMLElement>('.prose h2[id], .prose h3[id], .prose h4[id]'))
    : [];
  const tocHeadings = headingEls.filter((h) => byId.has(`${currentId}--${h.id}`));

  function liForHeading(heading: HTMLElement | null): HTMLElement | null {
    return heading ? byId.get(`${currentId}--${heading.id}`) ?? null : null;
  }

  /** Last heading whose top is above 30% of the viewport. */
  function currentHeadingLi(): HTMLElement | null {
    const limit = window.innerHeight * 0.3;
    let found: HTMLElement | null = null;
    for (const heading of tocHeadings) {
      if (heading.getBoundingClientRect().top <= limit) found = liForHeading(heading);
    }
    return found;
  }

  /**
   * Heading named by the URL hash (deep link or a TOC click). It wins over the scroll heuristic
   * while held (a click is still scrolling) and while it is on screen — the page cannot always
   * scroll a late heading up to the 30% line.
   */
  let hashAnchor: HTMLElement | null = null;
  let anchorHeldUntil = 0;

  function anchorOnScreen(heading: HTMLElement): boolean {
    const rect = heading.getBoundingClientRect();
    return rect.top < window.innerHeight && rect.bottom > 0;
  }

  function anchorLi(): HTMLElement | null {
    if (!hashAnchor || !document.contains(hashAnchor)) return null;
    if (performance.now() >= anchorHeldUntil && !anchorOnScreen(hashAnchor)) {
      hashAnchor = null; // the user scrolled away from the deep link: scroll-spy takes over
      return null;
    }
    return liForHeading(hashAnchor);
  }

  function setAnchor(heading: HTMLElement | null): void {
    hashAnchor = heading;
    anchorHeldUntil = performance.now() + 1500;
  }

  function syncFromScroll(): void {
    setActive(anchorLi() ?? currentHeadingLi() ?? byId.get(currentId) ?? null);
  }

  function hashHeading(): HTMLElement | null {
    if (!location.hash) return null;
    const el = document.getElementById(decodeURIComponent(location.hash.slice(1)));
    return el && headingEls.includes(el) ? el : null;
  }

  function syncHashOrScroll(): void {
    setAnchor(liForHeading(hashHeading()) ? hashHeading() : null);
    setActive(anchorLi() ?? currentHeadingLi() ?? byId.get(currentId) ?? null);
  }

  let frame = 0;
  function schedule(): void {
    if (frame) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      syncFromScroll();
    });
  }

  if (tocHeadings.length) {
    const observer = new IntersectionObserver(schedule, { rootMargin: '-64px 0px -65% 0px' });
    for (const heading of tocHeadings) observer.observe(heading);
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule, { passive: true });
    syncHashOrScroll();
  } else if (currentId) {
    setActive(byId.get(currentId) ?? null);
  }

  /* -------------------------------------------------------------- links, hash */

  panel.addEventListener('click', (event) => {
    const target = event.target as HTMLElement | null;
    const link = target?.closest?.<HTMLAnchorElement>('a.toc__link');
    if (!link || !panel.contains(link)) return;
    const linkUrl = new URL(link.href, location.href);
    if (linkUrl.pathname !== location.pathname) {
      document.dispatchEvent(new CustomEvent('ccdvp:navigate'));
      return; // normal navigation to another page
    }
    const heading = linkUrl.hash ? document.getElementById(decodeURIComponent(linkUrl.hash.slice(1))) : null;
    if (!heading) return;
    event.preventDefault();
    history.pushState(null, '', linkUrl.hash);
    heading.scrollIntoView({ block: 'start', behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
    heading.setAttribute('tabindex', '-1');
    heading.focus({ preventScroll: true });
    const li = liForHeading(heading);
    setAnchor(li ? heading : null);
    setActive(li ?? byId.get(currentId) ?? null);
    document.dispatchEvent(new CustomEvent('ccdvp:navigate'));
  });

  window.addEventListener('hashchange', syncHashOrScroll);
  window.addEventListener('popstate', syncHashOrScroll);
}
