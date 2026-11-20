// Theme toggle. The inline head script in BaseLayout.astro sets html[data-theme] before paint;
// this module only flips it on click, persists the choice, and follows the system while unset.
// See docs/ARCHITECTURE.md (DOM contract: html[data-theme], #theme-toggle, key "ccdvp:theme").

const THEME_KEY = 'ccdvp:theme';

type Theme = 'light' | 'dark';

function readStoredTheme(): Theme | null {
  try {
    const raw = localStorage.getItem(THEME_KEY);
    return raw === 'light' || raw === 'dark' ? raw : null;
  } catch {
    return null; // private mode / disabled storage
  }
}

function writeStoredTheme(theme: Theme): void {
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch {
    /* ignore: theme still applies for this page view */
  }
}

function currentTheme(): Theme {
  return document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
}

export function initTheme(): void {
  const btn = document.getElementById('theme-toggle'); // topbar button (desktop)
  const segments = document.querySelectorAll<HTMLButtonElement>('[data-theme-set]'); // drawer switch (mobile)

  const syncLabel = (): void => {
    // Label describes the *destination* theme.
    btn?.setAttribute('aria-label', currentTheme() === 'dark' ? 'Switch to light theme' : 'Switch to dark theme');
    segments.forEach((s) => s.setAttribute('aria-pressed', String(s.dataset.themeSet === currentTheme())));
  };
  const apply = (next: Theme): void => {
    document.documentElement.dataset.theme = next;
    writeStoredTheme(next);
    syncLabel();
  };
  syncLabel();

  btn?.addEventListener('click', () => apply(currentTheme() === 'dark' ? 'light' : 'dark'));
  segments.forEach((s) => s.addEventListener('click', () => apply(s.dataset.themeSet === 'dark' ? 'dark' : 'light')));

  // Follow OS changes live only while the reader has never chosen manually.
  if (typeof window.matchMedia !== 'function') return;
  const mq = window.matchMedia('(prefers-color-scheme: dark)');
  const onChange = (event: MediaQueryListEvent): void => {
    if (readStoredTheme() !== null) return;
    document.documentElement.dataset.theme = event.matches ? 'dark' : 'light';
    syncLabel();
  };
  // MediaQueryList.addEventListener('change') is supported everywhere we target
  // (the legacy addListener API is deprecated, so we don't fall back to it).
  mq.addEventListener('change', onChange);
}
