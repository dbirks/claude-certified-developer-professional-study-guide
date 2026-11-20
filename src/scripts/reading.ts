// Reading aids: progress bar, "last read" resume, copy-code buttons, heading anchor links,
// back-to-top. See docs/ARCHITECTURE.md for the DOM contract.
// localStorage keys are prefixed "ccdvp:" and every access is wrapped in try/catch.

const LAST_READ_KEY = 'ccdvp:last-read';
const SAVE_INTERVAL_MS = 2000;
const COPY_RESET_MS = 1500;
const TOAST_MS = 1600;
const BACK_TO_TOP_VH = 1.5;

interface LastRead {
  path: string;
  heading: string;
  title: string;
  at: number;
}

function prefersReducedMotion(): boolean {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;
}

function scrollBehavior(): ScrollBehavior {
  return prefersReducedMotion() ? 'auto' : 'smooth';
}

function readLastRead(): LastRead | null {
  try {
    const raw = localStorage.getItem(LAST_READ_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    const rec = parsed as Partial<LastRead>;
    if (typeof rec.path !== 'string' || !rec.path.startsWith('/')) return null;
    // Only allow slugger-safe ids as a fragment; anything else is dropped.
    const heading =
      typeof rec.heading === 'string' && /^[A-Za-z0-9_:.-]+$/.test(rec.heading) ? rec.heading : '';
    const title = typeof rec.title === 'string' && rec.title.trim() ? rec.title : 'last chapter';
    return { path: rec.path, heading, title, at: typeof rec.at === 'number' ? rec.at : 0 };
  } catch {
    return null;
  }
}

function writeLastRead(rec: LastRead): void {
  try {
    localStorage.setItem(LAST_READ_KEY, JSON.stringify(rec));
  } catch {
    /* storage unavailable: resume link simply stays hidden */
  }
}

/* ---------------------------------------------------------------- progress */

function initProgress(): void {
  const bar = document.getElementById('progress-bar');
  const article = document.querySelector<HTMLElement>('article.prose');
  if (!bar || !article) return;
  // Gelato topbar: a "% read" pill, shown on chapter pages only.
  const pill = document.body.dataset.currentId ? document.getElementById('read-pill') : null;
  pill?.removeAttribute('hidden');
  const pillText = pill ? document.getElementById('read-pill-text') : null;
  const pillFill = pill ? document.getElementById('read-pill-fill') : null;
  // The lesson ends where its source list begins (the list is reference material you can keep
  // scrolling forever); without one, the end of the article is the end of the lesson.
  // The "Mark as studied" button sits between the lesson and its sources, so it ends the lesson too.
  const lessonEnd =
    document.querySelector<HTMLElement>('article.prose .study-toggle') ??
    document.querySelector<HTMLElement>('article.prose section.sources') ??
    article;

  let queued = false;
  const update = (): void => {
    queued = false;
    const rect = article.getBoundingClientRect();
    const viewport = window.innerHeight || document.documentElement.clientHeight || 1;
    const scrolled = -rect.top; // px of the article above the viewport top
    const total = lessonEnd.getBoundingClientRect().top - rect.top - viewport;
    let pct: number;
    if (total <= 0) {
      // Whole lesson fits on one screen: read as soon as its end is above the fold.
      pct = scrolled >= total ? 100 : 0;
    } else {
      pct = (scrolled / total) * 100;
    }
    pct = Math.min(100, Math.max(0, pct));
    bar.style.width = `${pct.toFixed(2)}%`;
    // Floor so 100% only shows once the lesson's end is actually on screen (never "100%" early or "99%" at the end).
    if (pillText) pillText.textContent = `${pct >= 99.5 ? 100 : Math.floor(pct)}%`;
    if (pillFill) pillFill.style.width = `${pct.toFixed(1)}%`;
  };
  const onScroll = (): void => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(update);
  };

  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll);
  update();
}

/* -------------------------------------------------------------- last read */

function headingAtViewportLine(): string {
  const marks = document.querySelectorAll<HTMLElement>('.prose h2[id], .prose h3[id]');
  const line = window.innerHeight * 0.3;
  let id = '';
  for (const mark of marks) {
    if (mark.getBoundingClientRect().top <= line) id = mark.id;
    else break;
  }
  return id;
}

function chapterTitle(): string {
  return document.title.split(' · ')[0] ?? document.title;
}

function initLastRead(): void {
  const onChapter = (document.body.dataset.currentId ?? '').length > 0;

  if (onChapter) {
    let lastSave = 0;
    const save = (): void => {
      const now = Date.now();
      if (now - lastSave < SAVE_INTERVAL_MS) return; // throttled: at most one write per 2s of scrolling
      lastSave = now;
      writeLastRead({
        path: location.pathname,
        heading: headingAtViewportLine(),
        title: chapterTitle(),
        at: now,
      });
    };
    window.addEventListener('scroll', save, { passive: true });
    return;
  }

  // Home page: offer to resume. Never auto-scroll.
  const slot = document.getElementById('resume-link');
  if (!slot) return;
  const rec = readLastRead();
  if (!rec) return;
  const link = document.createElement('a');
  link.href = rec.heading ? `${rec.path}#${rec.heading}` : rec.path;
  link.textContent = rec.title;
  slot.textContent = '';
  slot.append(document.createTextNode('Continue where you left off: '), link);
  slot.removeAttribute('hidden');
}

/* ------------------------------------------------------- copy code blocks */

function announce(live: HTMLElement, message: string): void {
  live.textContent = '';
  live.textContent = message;
}

function selectFallback(code: HTMLElement | null, pre: HTMLPreElement): boolean {
  const selection = window.getSelection();
  if (!selection) return false;
  const range = document.createRange();
  range.selectNodeContents(code ?? pre);
  selection.removeAllRanges();
  selection.addRange(range);
  try {
    // Legacy path only (no Clipboard API). Cast so the deprecated DOM signature
    // doesn't leak into our types.
    const exec = (document as unknown as { execCommand?: (commandId: string) => boolean }).execCommand;
    return exec ? exec.call(document, 'copy') : false;
  } catch {
    return false;
  }
}

function initCopyCode(): void {
  const blocks = document.querySelectorAll<HTMLPreElement>('.prose pre');
  if (!blocks.length) return;

  let live = document.querySelector<HTMLElement>('#copy-live');
  if (!live) {
    live = document.createElement('div');
    live.id = 'copy-live';
    live.className = 'sr-only';
    live.setAttribute('aria-live', 'polite');
    document.body.append(live);
  }
  const liveRegion: HTMLElement = live;

  blocks.forEach((pre) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'copy-btn';
    btn.setAttribute('aria-label', 'Copy code');
    btn.setAttribute('aria-live', 'polite');
    btn.textContent = 'Copy';
    pre.append(btn);

    let reset: number | undefined;
    btn.addEventListener('click', () => {
      const code = pre.querySelector<HTMLElement>('code');
      const text = code?.innerText ?? pre.innerText;
      const done = (copied: boolean): void => {
        btn.textContent = copied ? 'Copied' : 'Press Ctrl+C';
        announce(liveRegion, copied ? 'Code copied to clipboard' : 'Code selected for copying');
        if (reset !== undefined) window.clearTimeout(reset);
        reset = window.setTimeout(() => {
          btn.textContent = 'Copy';
        }, COPY_RESET_MS);
      };

      if (navigator.clipboard?.writeText) {
        navigator.clipboard
          .writeText(text)
          .then(() => done(true))
          .catch(() => done(selectFallback(code, pre)));
      } else {
        done(selectFallback(code, pre));
      }
    });
  });
}

/* --------------------------------------------------------- heading anchors */

function showToast(message: string): void {
  document.querySelector('.toast')?.remove();
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.setAttribute('role', 'status');
  toast.textContent = message;
  document.body.append(toast);
  window.setTimeout(() => toast.remove(), TOAST_MS);
}

function copyText(text: string): Promise<boolean> {
  if (!navigator.clipboard?.writeText) return Promise.resolve(false);
  return navigator.clipboard.writeText(text).then(
    () => true,
    () => false,
  );
}

function initHeadingAnchors(): void {
  const headings = document.querySelectorAll<HTMLElement>('.prose h2[id], .prose h3[id], .prose h4[id]');
  headings.forEach((heading) => {
    const id = heading.id;
    if (!id || heading.querySelector('.heading-anchor')) return;
    // A copy-link anchor inside a <summary> (e.g. h2#sources) would fight the disclosure toggle.
    if (heading.closest('summary')) return;

    const anchor = document.createElement('a');
    anchor.className = 'heading-anchor';
    anchor.href = `#${id}`;
    anchor.setAttribute('aria-label', `Copy link to section: ${heading.textContent ?? id}`);
    anchor.textContent = '#';
    heading.append(anchor);

    anchor.addEventListener('click', (event) => {
      event.preventDefault();
      history.replaceState(null, '', `#${id}`);
      const absolute = new URL(`#${id}`, location.href).href;
      void copyText(absolute).then((copied) => showToast(copied ? 'Link copied' : absolute));
    });
  });
}

/* -------------------------------------------------------------- back to top */

function initBackToTop(): void {
  const btn = document.getElementById('back-to-top');
  if (!btn) return;

  const sync = (): void => {
    const threshold = window.innerHeight * BACK_TO_TOP_VH;
    btn.toggleAttribute('hidden', window.scrollY <= threshold);
  };
  window.addEventListener(
    'scroll',
    () => requestAnimationFrame(sync),
    { passive: true },
  );
  window.addEventListener('resize', sync);
  sync();

  btn.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: scrollBehavior() });
    document.getElementById('main')?.focus({ preventScroll: true });
  });
}

export function initReading(): void {
  initProgress();
  initLastRead();
  initCopyCode();
  initHeadingAnchors();
  initBackToTop();
}
