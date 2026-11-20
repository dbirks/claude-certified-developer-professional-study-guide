// "Mark as studied" progress tracking.
// Storage contract: localStorage `ccdvp:studied:v1` = JSON array of syllabus skill ids, e.g. ["2.1","1.4"].
// DOM contract (docs/ARCHITECTURE.md): `.study-toggle[data-skill] > .study-toggle__btn` on skill chapters,
// `.study-progress` in the home hero, `.is-studied` on `li.toc__item` and `.domain-card__row`.
// Skill ids for the TOC are read from each chapter row's `.toc__num` text (Toc.astro is untouched).
// Every localStorage access is wrapped in try/catch and keyed with the `ccdvp:` prefix.

const STUDIED_KEY = 'ccdvp:studied:v1';

const LABEL_ON = 'Studied';
const LABEL_OFF = 'Mark as studied';

function readStudied(): Set<string> {
  try {
    const raw = localStorage.getItem(STUDIED_KEY);
    if (!raw) return new Set();
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return new Set();
    const ids = parsed.filter((value): value is string => typeof value === 'string' && value.length > 0);
    return new Set(ids);
  } catch {
    return new Set();
  }
}

function writeStudied(ids: Set<string>): void {
  try {
    localStorage.setItem(STUDIED_KEY, JSON.stringify(Array.from(ids)));
  } catch {
    /* storage unavailable (private mode): the toggle still works for this page view */
  }
}

/* ------------------------------------------------------------------- toc */

/** Light a studied dot on every TOC chapter row whose `.toc__num` is a studied skill id. */
function applyToc(ids: Set<string>): void {
  const items = document.querySelectorAll<HTMLElement>('.toc__item[data-toc-id]');
  items.forEach((li) => {
    // Scoped to this row: a domain item contains nested chapter items with their own `.toc__num`.
    const num = li
      .querySelector<HTMLElement>(':scope > .toc__row > .toc__link > .toc__num')
      ?.textContent?.trim();
    li.classList.toggle('is-studied', Boolean(num) && ids.has(num ?? ''));
  });
}

/* ------------------------------------------------------------------ home */

/** Studied dots on the blueprint rows + the hero "Studied n of m skills" line. */
function applyHome(ids: Set<string>): void {
  const rows = Array.from(document.querySelectorAll<HTMLElement>('.domain-card__row'));
  const box = document.querySelector<HTMLElement>('.study-progress');
  if (!rows.length || !box) return;

  let studied = 0;
  rows.forEach((row) => {
    const skill =
      row.dataset.skill ?? row.querySelector<HTMLElement>('.domain-card__num')?.textContent?.trim() ?? '';
    const isStudied = skill.length > 0 && ids.has(skill);
    row.classList.toggle('is-studied', isStudied);
    if (isStudied) studied += 1;
  });

  let text = box.querySelector<HTMLElement>('.study-progress__text');
  let bar = box.querySelector<HTMLElement>('.study-progress__bar');
  if (!text || !bar) {
    text = document.createElement('span');
    text.className = 'study-progress__text';
    bar = document.createElement('span');
    bar.className = 'study-progress__bar';
    bar.setAttribute('aria-hidden', 'true');
    const fill = document.createElement('span');
    fill.className = 'study-progress__fill';
    bar.append(fill);
    box.append(text, bar);
  }
  text.textContent = `Studied ${studied} of ${rows.length} skills`;
  const fill = bar.querySelector<HTMLElement>('.study-progress__fill');
  if (fill) fill.style.width = `${((studied / rows.length) * 100).toFixed(2)}%`;
  box.removeAttribute('hidden');
}

/* --------------------------------------------------------- chapter toggle */

function initToggle(ids: Set<string>): void {
  const wrap = document.querySelector<HTMLElement>('.study-toggle[data-skill]');
  const btn = wrap?.querySelector<HTMLButtonElement>('.study-toggle__btn');
  const skill = wrap?.dataset.skill ?? '';
  if (!wrap || !btn || !skill) return;
  const label = btn.querySelector<HTMLElement>('.study-toggle__label');

  const setPressed = (studied: boolean): void => {
    btn.setAttribute('aria-pressed', String(studied));
    if (label) label.textContent = studied ? LABEL_ON : LABEL_OFF;
  };

  setPressed(ids.has(skill));

  btn.addEventListener('click', () => {
    const studied = btn.getAttribute('aria-pressed') !== 'true';
    setPressed(studied);
    // Merge with what is on disk so two tabs toggling different chapters don't clobber each other.
    const current = readStudied();
    if (studied) current.add(skill);
    else current.delete(skill);
    writeStudied(current);
    applyToc(current);
    applyHome(current);
  });
}

export function initStudy(): void {
  if (!document.querySelector('.study-toggle, .study-progress, .domain-card__row, .toc__item')) return;
  const ids = readStudied();
  initToggle(ids);
  applyToc(ids);
  applyHome(ids);
}
