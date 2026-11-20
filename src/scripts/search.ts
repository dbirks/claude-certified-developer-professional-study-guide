// Pagefind-backed search dialog. The index is generated after the build
// (`pagefind --site dist`), so the UI bundle is lazy-loaded on first open and the
// dev server (no index) shows a hint instead of failing.
// See docs/ARCHITECTURE.md: #search-open, dialog#search-dialog, body[data-base].

interface PagefindUIOptions {
  element: string;
  showSubResults?: boolean;
  showImages?: boolean;
  resetStyles?: boolean;
  autofocus?: boolean;
  translations?: { placeholder?: string };
}

interface PagefindUICtor {
  new (options: PagefindUIOptions): unknown;
}

declare global {
  interface Window {
    PagefindUI?: PagefindUICtor;
  }
}

const INPUT_SELECTOR = '#search-root input';

function isTypingTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el) return false;
  const tag = el.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable === true;
}

/** Pagefind assets live at <base>pagefind/ where base ends with "/". */
function assetBase(): string {
  const base = document.body.dataset.base;
  return base && base.endsWith('/') ? base : '/';
}

function appendAsset(el: HTMLLinkElement | HTMLScriptElement, src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    el.addEventListener('load', () => resolve());
    el.addEventListener('error', () => reject(new Error(`failed to load ${src}`)));
    document.head.append(el);
  });
}

function loadStyle(href: string): Promise<void> {
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = href;
  return appendAsset(link, href);
}

function loadScript(src: string): Promise<void> {
  const script = document.createElement('script');
  script.src = src;
  script.async = true;
  return appendAsset(script, src);
}

function showUnavailable(root: HTMLElement | null): void {
  if (!root) return;
  root.textContent = '';
  const p = document.createElement('p');
  p.className = 'search-empty';
  p.textContent = 'Search is available in the built site (run pnpm build).';
  root.append(p);
}

function focusInput(tries = 40): void {
  const input = document.querySelector<HTMLInputElement>(INPUT_SELECTOR);
  if (input) {
    input.focus();
    return;
  }
  if (tries > 0) window.setTimeout(() => focusInput(tries - 1), 50);
}

function sameDocument(link: HTMLAnchorElement): boolean {
  return link.pathname === location.pathname && link.search === location.search;
}

function reducedMotion(): boolean {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;
}

function applyHash(hash: string): void {
  if (!hash || hash === '#') return;
  if (location.hash === hash) {
    // Already on that fragment: no hashchange will fire, so scroll by hand.
    const el = document.getElementById(decodeURIComponent(hash.slice(1)));
    el?.scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth', block: 'start' });
  } else {
    location.hash = hash;
  }
}

export function initSearch(): void {
  const dialog = document.querySelector<HTMLDialogElement>('#search-dialog');
  if (!dialog) return;
  const openBtn = document.getElementById('search-open');
  const closeBtn = document.getElementById('search-close');
  const root = document.getElementById('search-root');

  let ready = false;
  let broken = false;
  let loading: Promise<void> | null = null;

  const loadUi = (): Promise<void> => {
    if (!loading) {
      const base = assetBase();
      loading = loadStyle(`${base}pagefind/pagefind-ui.css`)
        .then(() => loadScript(`${base}pagefind/pagefind-ui.js`))
        .then(() => {
          const PagefindUI = window.PagefindUI;
          if (!PagefindUI) throw new Error('PagefindUI missing');
          new PagefindUI({
            element: '#search-root',
            showSubResults: true,
            showImages: false,
            resetStyles: false,
            autofocus: true,
            translations: { placeholder: 'Search topics, APIs, terms' },
          });
        });
      loading.then(
        () => {
          ready = true;
        },
        () => {
          broken = true;
          showUnavailable(root);
        },
      );
    }
    return loading;
  };

  const open = (): void => {
    if (typeof dialog.showModal === 'function') dialog.showModal();
    else dialog.setAttribute('open', '');
    if (ready) focusInput();
    else if (!broken) void loadUi().then(() => focusInput(), () => undefined);
    else focusInput();
  };

  const close = (): void => {
    if (typeof dialog.close === 'function') dialog.close();
    else dialog.removeAttribute('open');
    openBtn?.focus({ preventScroll: true });
  };

  openBtn?.addEventListener('click', open);
  closeBtn?.addEventListener('click', close);

  document.addEventListener('keydown', (event) => {
    if (event.defaultPrevented) return;
    const withMod = event.metaKey || event.ctrlKey;
    if (withMod && !event.altKey && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      if (dialog.open) close();
      else open();
      return;
    }
    if (!withMod && !event.altKey && event.key === '/' && !dialog.open && !isTypingTarget(event.target)) {
      event.preventDefault();
      open();
    }
  });

  dialog.addEventListener('click', (event) => {
    const target = event.target as HTMLElement | null;
    if (!target) return;

    // Click on the ::backdrop lands on the dialog element itself.
    if (target === dialog) {
      close();
      return;
    }

    const link = target.closest<HTMLAnchorElement>('#search-root a[href]');
    if (!link) return;
    if (sameDocument(link)) {
      // Same page: close first, then navigate the fragment ourselves.
      event.preventDefault();
      const hash = link.hash;
      close();
      applyHash(hash);
    } else {
      close();
    }
  });
}
