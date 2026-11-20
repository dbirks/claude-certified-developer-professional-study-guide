# Architecture contract

Static Astro 7 + MDX site, deployed to GitHub Pages at `/<repo>/`. No UI framework: client behavior is plain
TypeScript modules in `src/scripts/`, bundled by Astro; styling is hand-written CSS in `src/styles/`. Every page is
a real static HTML file, so refresh and deep links work on GitHub Pages without a 404 fallback.

The visual layer is the "Gelato" system (handoff frames 2a, 2b, 3a, 3c, 3e–3g; reference images in `docs/design/`).

## Layout of the repo

```
content/                      MDX chapters (outside src). One file per skill + reference pages.
  00-introduction.mdx         kind: intro (rendered on the home page)
  0N-<domain-slug>/<NN>-<skill-slug>.mdx   kind: skill, skill: "2.1", slug: reliability
  reference/<slug>.mdx        kind: reference (glossary, api-reference, building-blocks,
                              component-demo = test fixture, only built with CCDVP_DEMO=1)
  practice/domain-N.mdx       kind: reference, slug: practice-domain-N (only built with CCDVP_PRACTICE=1)
research/
  exam-guide.md               verified official blueprint
  PACKET_FORMAT.md            how research packets and citations are written
  packets/<slug>.md           research notes per skill
  citations/<slug>.yaml       verbatim-quote citations per skill (rendered on the site)
  quote-check/<slug>.json     per-citation result of scripts/verify-quotes.mjs (drives the "matches" pill)
  fact-check/<slug>.md        per-chapter fact-check notes
  sources.yaml                generated aggregate (scripts/build-research-index.mjs)
  coverage-matrix.md, fact-check-log.md
src/
  content.config.ts           `chapters` collection + the CCDVP_ONLY / CCDVP_DEMO / CCDVP_PRACTICE glob rules
  data/syllabus.ts            GUIDE + DOMAINS / skills (official titles, objectives, stable slugs, short titles)
  lib/site.ts                 url(path), skillPath(), referencePath(), skillOrder() — ALWAYS use url() for links
  lib/toc.ts                  getToc(): TocNode[] built from syllabus + MDX heading ASTs (cached per build)
  lib/citations.ts            getCitations(stem): Citation[] (yaml + quote-check merge)
  lib/mdx-components.ts       components injected into every MDX file (no imports needed in MDX)
  layouts/BaseLayout.astro    page shell (DOM contract below)
  pages/index.astro           home; pages/[...path].astro skill + reference pages
  components/                 Toc, SearchDialog, CitePopover, SourceList, Icon, mdx/*
  scripts/main.ts             imports and calls each init*() once
  styles/global.css           @imports one css file per concern (ownership below)
tests/
  serve.mjs                   static server used by Playwright's webServer (dist + port + base path)
  e2e/                        a11y, citations, drawer, gelato, layout, navigation, search, toc + helpers.ts
scripts/
  check-links.mjs             internal href/src + #fragment + duplicate-id audit of a built dist
  check-citations.mjs         citation yaml validation + every <Cite id> resolves
  verify-quotes.mjs           re-fetch every cited URL, confirm the quote verbatim (HTML + PDF)
  check-alignment.mjs         vertical ink-centring audit of pills/badges/rows in a built dist (Playwright)
  size-report.mjs             page-weight audit (HTML → CSS → used fonts; JS import graph)
  build-research-index.mjs    regenerate research/sources.yaml + coverage-matrix.md
docs/
  ARCHITECTURE.md             this contract
  design/                     Gelato handoff reference PNGs
  a11y-report.md              axe-core audit results (from tests/e2e/a11y.spec.ts)
  perf-report.md              page-weight / JS audit (from scripts/size-report.mjs)
```

URLs: skill `/<domain-slug>/<skill-slug>/`, reference `/reference/<slug>/`, home `/`. Trailing slash always.
Heading ids come from Astro's github-slugger (`## Retry budgets` → `#retry-budgets`).
Never hard-code `/` root paths — `url()` prefixes `import.meta.env.BASE_URL`.

## Build flags

| Env | Effect |
|---|---|
| `CCDVP_ONLY=<slug>` | Content glob matches only `**/*<slug>.mdx` + `00-introduction.mdx`, so parallel chapter drafting workers don't break each other's builds |
| `CCDVP_DEMO=1` | Include `content/reference/component-demo.mdx` (the all-components test page); also implied by `CCDVP_ONLY=component-demo` |
| `CCDVP_PRACTICE=1` | Include `content/practice/**` (excluded by default, so the TOC `d-practice` group normally does not exist) |
| `BASE_PATH=/repo/` | Astro `base` (CI sets it from `actions/configure-pages`); `url()` and the Pagefind asset paths follow it |
| `SITE_URL` | Astro `site` (defaults to `https://dbirks.github.io`) |

`pnpm build` = `astro build && pagefind --site dist`. Shiki uses `github-dark` for **both** site themes: code blocks
are always the dark ink slab (`--code-block-bg`). Parallel workers build to their own dir:
`pnpm astro build --outDir .ccdvp-<slug>/dist` (`.ccdvp-*/` is gitignored).

## DOM contract (BaseLayout.astro)

| Selector | Element | Notes |
|---|---|---|
| `html[data-theme="light"\|"dark"]` | root | set before paint by an inline head script; key `ccdvp:theme` |
| `body[data-current-id]` | body | TocNode id of the current chapter, e.g. `c-reliability`; empty on home |
| `body[data-base]` | body | base URL with trailing slash, e.g. `/repo/` |
| `.skip-link` | a | first focusable element → `#main` |
| `.progress > .progress__bar#progress-bar` | divs | width = % of article read (reading.ts) |
| `header.topbar` | header | sticky; `.topbar__pill` height `--topbar-h` (52px), 60px at ≥1024px. `.topbar::before` is the **frosted band** (`backdrop-filter: blur(14px) saturate(1.2)`, height `--topbar-band` 17px / 20px desktop, with an `@supports not (backdrop-filter)` fallback) |
| `.topbar > .topbar__pill` | div | the floating pill; on desktop it stretches into a wide bar |
| `#toc-toggle.icon-btn.topbar__menu` | button | `aria-controls="toc-panel"`, `aria-expanded`; holds `.hamburger > span×3` |
| `a.topbar__title` | a | `CCDV-P <span class="topbar__title-rest">Study Guide</span>` |
| `#topbar-section.topbar__section` | span | section label; hidden < 1024px (as are `.topbar__title-rest`, `.topbar__search-text/-key`, `.topbar__theme`) |
| `.topbar__actions` | div | search button, read pill, theme toggle (mobile order puts the read pill before search; CSS `order`) |
| `#search-open.icon-btn.topbar__search` | button | `aria-haspopup="dialog"` + `Icon name="search"`, `span.topbar__search-text`, `span.topbar__search-key` (holds the `square-slash` icon) |
| `#read-pill.read-pill[hidden]` | span | chapter only; `.read-pill__bar > #read-pill-fill.read-pill__fill` + `#read-pill-text` (`"0%"`…`"100%"`, reading.ts) |
| `#theme-toggle.icon-btn.topbar__theme` | button | ≥1024 only; `Icon` pair `.theme-icon.theme-icon--moon` / `.theme-icon--sun` |
| `.shell` | div | grid 1col → `--sidebar-w 1fr` ≥1024 → `+ --onpage-w` ≥1280 |
| `#toc-panel.toc-panel[data-state="open"\|"closed"]` | aside | sidebar ≥1024px, drawer below |
| `.toc-panel__head > .toc-panel__title` | | |
| `.toc-controls > .toc-controls__btn[data-toc-action="collapse-all"\|"expand-current"\|"expand-all"]` | buttons | group `aria-label="Table of contents view"` |
| `.toc-controls > .theme-switch > button[data-theme-set="light"\|"dark"][aria-pressed]` | buttons | drawer theme switch (<1024); theme.ts keeps `aria-pressed` in sync |
| `#toc-close.icon-btn.toc-panel__close` | button | |
| `nav.toc` | nav | contains `<Toc>` |
| `#toc-backdrop.toc-backdrop[hidden]` | div | drawer backdrop |
| `main#main.main[tabindex="-1"]` > `article.prose[data-pagefind-body]` | | chapter content |
| `.chapter-head > .chapter-head__row > .chapter-head__eyebrow + .status.status--draft\|fact-checked\|pending` | | eyebrow = `2.1 · Domain 2 · 20%`; status pill has `title="Last reviewed <date>"` |
| `.chapter-head__title`, `.chapter-head__lede` | h1, p | lede = frontmatter `summary` |
| `details.objective > summary > span + Icon.objective__plus + Icon.objective__minus`, `.objective__src` | | `.objective__src` names the guide version/§ |
| `.pending` | div | placeholder when a skill has no MDX yet |
| `nav.pager > a.pager__link--prev/--next > .pager__dir + .pager__label` | | `.pager__dir` = arrow `Icon` + `.sr-only` prefix + skill number; `.pager__label` = syllabus `short` title |
| `aside.onpage > .onpage__title + ul.onpage__list > li.onpage__item.onpage__item--h2\|--h3 > a[data-onpage-link=<slug>]` | | ≥1280px; H2/H3 only, plus a `Sources` entry. CSS only indents `--h3` and lights `a.is-active` (toc.ts) |
| `#back-to-top.back-to-top[hidden]` | button | |
| `dialog#search-dialog.search-dialog` | | `.search-dialog__head > .search-dialog__title.sr-only + #search-close.search-dialog__close.icon-btn`, `#search-root.search-root` (Pagefind UI mounts here), `.search-dialog__hint` |
| `#cite-backdrop.cite-backdrop[hidden]` + `#cite-pop.cite-pop[role="dialog"][hidden]` | | citation sheet, see below |

### Citation sheet (CitePopover.astro + cite.ts)

Empty markup on purpose — `cite.ts` copies it from the matching `#src-<id>` row and toggles
`.cite-pop--open` / `.cite-backdrop--show`:

```
#cite-pop.cite-pop
├─ .cite-pop__grab
├─ .cite-pop__head   → #cite-pop-n.cite-pop__n · a#cite-pop-title.cite-pop__title · .cite-pop__close.icon-btn
├─ .cite-pop__pills  → #cite-pop-tag.cite-pop__tag · #cite-pop-match.cite-pop__match (Icon check + #cite-pop-match-text)
├─ blockquote#cite-pop-quote.cite-pop__quote
├─ p#cite-pop-supports.cite-pop__supports → .cite-pop__supports-label + #cite-pop-supports-text
├─ p#cite-pop-meta.cite-pop__meta
└─ .cite-pop__actions → a#cite-pop-open.cite-pop__open (Icon external-link) + button#cite-pop-jump.cite-pop__jump
```

Bottom sheet + backdrop < 640px (swipe-down ≥60px closes, `SWIPE_CLOSE_PX`), anchored card ≥640px.
`#cite-pop-match` text comes from `li.source[data-match]`: `ok` → "Quote matches page", `ok-loose` →
"Quote closely matches". `#cite-pop-jump` opens the source list and scrolls to `#sources`.

### Chapter source list (SourceList.astro)

```
section.sources[aria-labelledby="sources"] > details.sources__details
├─ summary.sources__summary → h2#sources + .sources__count + Icon.chevron-down.sources__chev
├─ p.sources__note
└─ ol.sources__list > li.source#src-F3[value=3][data-tag=FACT][data-match=ok]
     ├─ .source__head → .source__n · a.source__title[target=_blank] · span.source__tag.source__tag--fact
     ├─ blockquote.source__quote[cite]
     ├─ p.source__meta   host · Accessed <date> · <version_note>
     └─ p.source__claim  Supports: <claim>
```

The list is collapsed by default; `cite.ts` opens the `<details>` before any `#sources` / `#src-*` jump
(deep links and the on-page rail depend on `h2#sources` staying inside the summary).

### Icon.astro

`<Icon name="badge-check" size={15} stroke={2.5} class="toc__pending-icon" />` inlines a Lucide glyph (`lucide-static`) at
build time → `svg.icon.icon--<name>` plus the optional `class`, `aria-hidden="true" focusable="false"`, `stroke="currentColor"`.
Unknown names throw at build. New icons must come from `node_modules/lucide-static/icons/`.

## TOC markup (Toc.astro, recursive)

Domain rows lead with the badge and **end** with the twisty:

```html
<ul class="toc__list" data-depth="0">
  <li class="toc__item" data-toc-id="d-2" data-depth="0" data-kind="domain">
    <div class="toc__row">
      <span class="toc__badge">2</span>
      <a class="toc__link" href="…" data-toc-link="d-2">
        <span class="toc__label">Production Integration…</span><span class="toc__meta">20%</span>
      </a>
      <button class="toc__twisty" type="button" aria-expanded="false" aria-controls="toc-sub-d-2"
              aria-label="Expand Production Integration…"><svg chevron-right/></button>
    </div>
    <ul class="toc__list" id="toc-sub-d-2" data-depth="1" hidden> … </ul>
  </li>
</ul>
```

- `.toc__badge` only on depth 0; non-numeric badges (`?` practice, `R` reference) also get `.toc__badge--letter`.
- Chapter rows (depth 1) put the skill number in `.toc__num` **inside** `.toc__link`, before `.toc__label`.
- `.toc__meta` = the domain weight as `"<n>%"`. Pending chapters add `Icon.clock.toc__pending-icon`.
- Leaf nodes render `<span class="toc__twisty-spacer" aria-hidden="true">` instead of the button.
- Nested lists are `toc-sub-<nodeId>`, `data-depth` capped at 4.
- Server render: ancestors of `currentId` and the chapter itself are expanded (no `hidden`,
  `aria-expanded="true"`); the current link has `aria-current="page"`, its `li` has `.is-current`, ancestors
  `.is-ancestor`. Chapter status `pending` → `.toc__link--pending` (muted, still a link).
- Client (`toc.ts`): scroll-spy → `.is-active` on the heading's link, `.is-active-path` on ancestor `li`s; the
  active chain is auto-expanded and the matching right-rail link is lit (`onpage` `a.is-active`).
  Explicit collapse/expand choices persist in localStorage `ccdvp:toc:v1` as `{ [tocId]: true|false }`.
  Same-page links use `pushState` + focus management and dispatch the `ccdvp:navigate` event (drawer closes,
  citation sheet closes).

## Client scripts (src/scripts/, one `init*()` each, called by main.ts in this order)

| Module | Owns |
|---|---|
| `theme.ts` | `#theme-toggle`, `[data-theme-set]`, `html[data-theme]`, key `ccdvp:theme`; follows the system while unset |
| `drawer.ts` | `<1024px`: `#toc-toggle` / `#toc-close` / `#toc-backdrop`, left-edge open swipe (28px zone), left-swipe close, Escape |
| `toc.ts` | twisties + `data-toc-action` buttons, scroll-spy, `ccdvp:toc:v1`, `ccdvp:navigate` |
| `reading.ts` | `#progress-bar`, `#read-pill*`, `#resume-link`, copy buttons (`.copy-btn`, `#copy-live`, `.toast`), `.heading-anchor`, `#back-to-top`; key `ccdvp:last-read` |
| `search.ts` | `#search-open` / `#search-close` / `dialog#search-dialog`; lazy-loads `<base>pagefind/pagefind-ui.{css,js}` into `#search-root` (dev server shows a hint instead) |
| `cite.ts` | `.cite` links → `#cite-pop`; opens `details.sources__details` for jumps; `ccdvp:navigate` closes it |

Every localStorage access is wrapped in try/catch and keyed with the `ccdvp:` prefix. Motion respects
`prefers-reduced-motion`.

## Components in MDX (no import needed)

Injected via `src/lib/mdx-components.ts`: `Cite, Callout, ExamLens, SelfCheck, Figure, Flow, Sequence, SignalTable`.

```mdx
Claude returns HTTP 529 when the API is overloaded.<Cite id="F3" />  Two sources: <Cite id="F3 F7" />

<Callout type="mistake" title="Retrying a refusal">Markdown body.</Callout>   type: mistake | version | note
<ExamLens>Markdown body: the decision pattern a scenario may test.</ExamLens>  (labeled editorial inference)
<SelfCheck question="Why can HTTP 200 still be a failure?">Markdown answer.</SelfCheck>
<SelfCheck question="Answer to Q3" reveal>…</SelfCheck>                       reveal forces the hidden-answer card
<Figure caption="Caption sentence.">…any content: Flow, Sequence, table, image…</Figure>
<Flow steps={["Query", "ACL filter", {label: "Rerank", note: "top 50 → 8", tone: "good"}]} />  direction="vertical"
<Sequence actors={["Agent", "Step log", "Payments API"]}
          messages={[{ from: 0, to: 1, label: "record intent key=k1" },
                     { at: 0, note: "process crashes", tone: "bad" },
                     { from: 2, to: 0, label: "200 OK", dashed: true }]} />
<SignalTable caption="Classify before you retry."
             rows={[{ signal: "400 invalid_request_error", verdict: "fail" },
                    { signal: "429 rate_limit_error", verdict: "retry" },
                    { signal: "529 overloaded", verdict: "conditional" }]} />
```

- `Callout` → `aside.callout.callout--<type>` with `aria-label`; body in `.callout__body`.
  `mistake`/`note` show `.callout__title > .callout__kind + .callout__name`; `version` collapses to one
  `.callout__version` row (`"Version check · <date>"`).
- `ExamLens` → `aside.exam-lens` + `.exam-lens__title > .exam-lens__name + .exam-lens__note` + `.exam-lens__body`.
- `SelfCheck`: teaching default is an always-visible `.self-check` card. `reveal` (auto when the question starts
  with "Answer to") renders `details.self-check.self-check--reveal` with `.self-check__pill`
  (`.self-check__pill-show` / `.self-check__pill-hide`). Both variants use `.self-check__q`,
  `.self-check__badge--q/--a`, `.self-check__text`, `.self-check__a > .self-check__body`.
- `Figure` → `figure.figure > .figure__body[tabindex=0][role=group] + figcaption.figure__caption`.
- `Flow` → `ol.flow.flow--horizontal|vertical > li.flow__item > span.flow__arrow + .flow__step.flow__step--good|--bad`
  with `.flow__label` / `.flow__note`; right/down arrow pair is toggled in CSS.
- `Sequence` → inline SVG built at build time (`.seq__svg`, `.seq__box`, `.seq__actor`, `.seq__life`, `.seq__msg`,
  `.seq__msg--dashed`, `.seq__label`, `.seq__note--bad|good|neutral`, content-hash marker id) plus an
  `ol.seq__alt.sr-only` transcript. Geometry constants live in the component (COL_W 200, ROW_H 40).
- `SignalTable` → `figure.signal-table > ul > li.signal-table__row > code.signal-table__signal +
  span.signal-table__tag.signal-table__tag--fail|retry|conditional` (labels "Fail fast" / "Retry" / "Depends";
  unknown verdicts degrade to `conditional`) + optional `figcaption.signal-table__caption`. Styles in `signal.css`.
- `Cite` → `<sup class="cite-group"><a class="cite" href="#src-F3" data-cite="F3" aria-label="Source 3"
  role="button" aria-haspopup="dialog">3</a></sup>`; brackets/commas come from `cite.css`.

## Citations data

`research/citations/<slug>.yaml` → `Citation { id, n, claim, tag, url, title, source, quote, accessed,
version_note?, match? }`. `n` is the digits of `id`; `match` (`ok` | `ok-loose`) is merged in at build time from
`research/quote-check/<stem>.json` produced by `scripts/verify-quotes.mjs`. Tag labels: FACT → Documented,
REC → Recommended practice, VER → Version-sensitive, STD → Standard.

## CSS ownership (global.css @imports one file per concern; all use tokens from tokens.css)

| File | Owner concern |
|---|---|
| tokens.css | fonts + colors, sizes, radii, spacing, shadows (light + dark) |
| base.css | reset, body, links, focus ring, skip link, `.sr-only`, `.icon-btn`, `.theme-icon` |
| layout.css | topbar pill + frosted band, shell grid, main, on-page rail, pager, chapter/home headers, status pills, pending |
| prose.css | article typography: headings, paragraphs, lists, quotes, tables, rules, `details.objective` |
| code.css | inline code on butter, dark code blocks, `.copy-btn` placement |
| toc.css | toc-panel (sidebar + drawer), backdrop, toc tree, `.toc-controls` |
| reading.css | progress bar, copy button, heading anchors, toast, back-to-top, resume pill |
| cite.css | `.cite`, `.sources`, `#cite-pop`, `.cite-backdrop` |
| mdx.css | Callout, ExamLens, SelfCheck, Figure, Flow, Sequence |
| home.css | home hero card, stat pills, resume pill, blueprint domain cards |
| search.css | search dialog + the Pagefind UI inside `#search-root` |
| signal.css | SignalTable card |
| print.css | print rules (white column, lightened fills) |

Colors/fonts must come from tokens.css custom properties. Breakpoints used across the CSS: < 640 (phone),
640–1023 (drawer), ≥ 1024 (sidebar + topbar search label/theme toggle), ≥ 1280 (on-page rail).

## Design tokens (Gelato; tokens.css implements exactly these)

Light (`:root`, `:root[data-theme='light']`) — warm cream + pastel fills:
`--bg #fff8f1` `--bg-subtle #fbefe4` `--surface #ffffff` `--surface-alt #fff8f1` `--status-bg #ffffff`
`--ink #2b2330` `--ink-muted #6e6470` `--border #efe3d8` `--border-strong #e2d3c6` `--focus #2a7de1`
`--backdrop rgba(43,35,48,.38)` `--shadow 0 8px 28px rgba(80,50,40,.14)` `--shadow-pill 0 2px 10px rgba(80,50,40,.06)`.

Pastel pairs (fill + readable ink; `--*-body` where a second text tone is needed):
`--sky #dcebfa / --sky-ink #2a4a6e / --sky-title #1e2a3a` (hero) ·
`--pistachio #ddefd8 / --pistachio-ink #2f5b33 / --pistachio-body #1f3a22 / --pistachio-note #3f6b43` (ok, next) ·
`--strawberry #fbdde3 / --strawberry-ink #8c2f45 / --strawberry-body #4a1f2a` (mistakes) ·
`--butter #fff0c2 / --butter-ink #7a5a00 / --butter-body #4a3800` (code, warn).
Code: `--code-ink #5f4600`, `--answer-bg #fff8e0`, `--answer-ink #3a2e1e`,
`--code-block-bg #2b2330`, `--code-block-fg #f6e9ee`, `--contrast-bg #2b2330`, `--contrast-fg #fff8f1`,
`--pager-next-label #e7c9d3`.

Dark (`:root[data-theme='dark']`) — designed, warm plum-gray, never black; pastels become muted fills with pastel
text: `--bg #34313a` `--bg-subtle/--surface-alt #3a3740` `--surface #423e48` `--status-bg #34313a`
`--ink #f3eef0` `--ink-muted #bdb5bf` `--border #4a4550` `--border-strong #57515e` `--focus #6aa8f0`
`--sky #3c4a5a / --sky-ink #cfe2f7 / --sky-title #eaf3fd` ·
`--pistachio #3c4e40 / --pistachio-ink #cdebc6 / --pistachio-body #e3f5de` ·
`--strawberry #5a3f47 / --strawberry-ink #f8cbd5 / --strawberry-body #f6dce2 / --strawberry-title #fde7ec` ·
`--butter #554e32 / --butter-ink #fbe7a6 / --butter-body #f5edd2`;
`--code-ink #fbe7a6` `--answer-bg #4a4536` `--answer-ink #f5edd2` `--code-block-bg #2a2830`
`--code-block-fg #f6e9ee`; dark flips the primary action: `--contrast-bg #fbe7a6` `--contrast-fg #2b2330`
`--pager-next-label #7a5a00`; `--backdrop rgba(20,18,24,.5)` `--shadow 0 8px 28px rgba(20,18,24,.45)`
`--shadow-pill 0 2px 10px rgba(20,18,24,.3)`.

Aliases kept so older CSS keeps working (both themes): `--accent`/`--accent-ink` → `--sky-ink`,
`--accent-soft` → `--sky`, `--code-bg`/`--warn-soft` → `--butter`, `--warn` → `--butter-ink`,
`--bad` → `--strawberry-ink`, `--bad-soft` → `--strawberry`.

Fonts (`@fontsource`, OFL): `--font-serif "Young Serif", Georgia, serif` (site title, H1/H2, card titles) ·
`--font-sans "Manrope Variable", system-ui, -apple-system, "Segoe UI", sans-serif` (body, UI, H3/H4) ·
`--font-mono "DM Mono", ui-monospace, "DejaVu Sans Mono", monospace` (all code; never serif).
**Young Serif ships weight 400 only — never set `font-weight > 400` on serif text.** The four Latin faces
(Manrope, Young Serif, DM Mono 400 + 500) are `preload`ed from BaseLayout to avoid reflow.

Sizes: `--measure 72ch` on `.prose` and `.pager` (fixed `720px` column ≥1024px) · `--topbar-h 52px` ·
`--sidebar-w 300px` · `--onpage-w 220px` ·
radii `--r-xs 8 / --r-sm 16 / --r-md 20 / --r-lg 22 / --r-xl 26 / --r-2xl 28 / --r-pill 999` (`--radius` = `--r-sm`) ·
spacing `--space-1 4 … --space-6 32` px · `.icon-btn` touch targets 44×44px.

## Checks

| Command | What it proves |
|---|---|
| `pnpm check` | `astro check` types (Astro + TS) |
| `pnpm build` | Astro build + `pagefind --site dist` index |
| `pnpm check:links` | `scripts/check-links.mjs dist` — every base-relative `href`/`src` resolves, `#fragments` exist, no duplicate ids (honors `BASE_PATH`) |
| `pnpm check:citations` | `scripts/check-citations.mjs [slug…]` — citation yaml is valid (tags FACT/REC/VER/STD) and every `<Cite id>` resolves |
| `pnpm verify:quotes` | `scripts/verify-quotes.mjs [slug…]` — refetch each cited URL, quote must appear verbatim after whitespace/quote/dash normalization; PDFs are text-extracted with `uvx --with pypdf`. Writes `research/quote-check/<slug>.json`, HTTP cache under `$XDG_CACHE_HOME/ccdvp-quote-cache` |
| `node scripts/check-alignment.mjs <dist> [paths…]` | glyph-ink vertical centering of pills/badges/rows (env `ALIGN_TOL` 1, `ALIGN_WIDTH` `390,1440`, `ALIGN_THEME`); Playwright Chromium |
| `node scripts/size-report.mjs <dist> [--page label=path] [--json]` | page weight: HTML → CSS → fonts actually used, plus JS import graph |
| `node scripts/build-research-index.mjs` | regenerate `research/sources.yaml` + `coverage-matrix.md` |
| `pnpm test:e2e` | Playwright, `desktop` (1366×900) + `mobile` (390×844, touch) projects, against a `CCDVP_DEMO=1 BASE_PATH=/ccdvp-test/` build served by `tests/serve.mjs` on :4391. Suites: `a11y.spec.ts` (axe-core WCAG 2.0/2.1/2.2 AA × theme × drawer/citation state → `.ccdvp-a11y/axe-results.jsonl`, feeds `docs/a11y-report.md`), `citations`, `drawer`, `gelato` (topbar/pill/search-label/read pill/citation sheet/self-check/pager/fonts/overflow/subpath), `layout`, `navigation`, `search`, `toc` |

CI (`.github/workflows/deploy.yml`, Node 24, pnpm): `check:citations` → `check` → `build` (with `BASE_PATH`,
`SITE_URL`) → `check:links` → `test:e2e` → upload/deploy `dist`.
