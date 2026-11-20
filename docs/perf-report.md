# Performance audit — page weight & client JS

Audited 2026-11-19 against a full production build of the whole site (29 pages). Report only: no app code was
changed. Every number below is reproducible with the two commands in §1.

## 1. How to reproduce

```bash
pnpm astro build --outDir .ccdvp-perf/dist && pnpm exec pagefind --site .ccdvp-perf/dist
node scripts/size-report.mjs .ccdvp-perf/dist            # markdown tables (this file §2, §4)
node scripts/size-report.mjs .ccdvp-perf/dist --json     # same data, machine-readable

python3 -m http.server 9417 --directory .ccdvp-perf/dist &
CHROME_PATH=$HOME/.cache/ms-playwright/chromium-1255/chrome-linux64/chrome \
  pnpm dlx lighthouse@12 http://127.0.0.1:9417/production-integration/reliability/ \
  --preset=perf --form-factor=mobile --screenEmulation.mobile --quiet \
  --chrome-flags="--headless=new" --output=json --output-path=lh-chapter.json
```

`scripts/size-report.mjs` walks each page's real asset graph: HTML → linked stylesheets → `@font-face` files, and
HTML → module `<script>` → its import graph inside `dist/_astro/`. Fonts are matched against each face's
`unicode-range` using the codepoints actually present in the page text, so "what a Latin page downloads" is
measured, not guessed. Lighthouse 12.8.2 + Playwright Chromium, mobile emulation, simulated throttling
(4× CPU throttle, simulated 4G), no `--throttling-method=provided` (i.e. lab numbers, not field data).

Build totals: 29 pages, `dist/` = 9,820 KiB, of which pagefind's search index is 1,444 KiB and `_astro/` fonts are
234 KiB (161.8 KiB woff2 + 72.6 KiB legacy woff). There are **no images and no third-party requests** anywhere.

## 2. Page weight (from `scripts/size-report.mjs`)

| Page | HTML (dist-relative) | HTML raw | HTML gzip | CSS raw | CSS gzip | JS raw | JS gzip | inline JS | woff2 needed raw | files | Transfer est. |
|---|---|---|---|---|---|---|---|---|---|---|---|
| **home** | index.html | 204.1 KiB | 18.7 KiB | 66.0 KiB | 15.5 KiB | 21.0 KiB | 6.9 KiB | 362 B | 79.7 KiB | 4 | 121.2 KiB |
| **chapter** | production-integration/reliability/index.html | 298.1 KiB | 36.1 KiB | 66.0 KiB | 15.5 KiB | 21.0 KiB | 6.9 KiB | 362 B | 79.7 KiB | 4 | 138.6 KiB |
| **reference** | reference/glossary/index.html | 274.1 KiB | 34.1 KiB | 66.0 KiB | 15.5 KiB | 21.0 KiB | 6.9 KiB | 362 B | 88.9 KiB | 5 | 145.8 KiB |

Transfer est. = gzip(HTML) + gzip(CSS) + gzip(JS graph) + raw woff2 bytes the page needs + inline JS. woff2 is
Brotli-compressed already, so gzip does nothing to it and it is counted raw.

Same page types, one step closer to the wire (GitHub Pages serves gzip/brotli for HTML/CSS/JS, but **not** for
woff2, which is why fonts dominate):

- first visit, chapter: ~139 KiB — 57% of it the 80 KiB of webfonts.
- repeat visit (CSS/JS/fonts cached, both hashed assets and every `/_astro/` file are immutable): ~36 KiB, of which
  **13.4 KiB (37%) is the sidebar TOC markup** that is identical on all 29 pages.
- fixed payload every navigation re-pays (CSS + JS gzip only): 22.4 KiB × 29 pages = 650 KiB duplicated.

## 3. Lighthouse (mobile, simulated throttling, one run per page)

| Page | Perf | FCP | LCP | TBT | CLS | SI | TTI | Total byte weight | DOM nodes |
|---|---|---|---|---|---|---|---|---|---|
| chapter (`/production-integration/reliability/`) | **83** | 2.1 s | 2.1 s | 210 ms | **0.209** | 2.2 s | 3.3 s | 467 KiB / 8 req | **3,695** |
| home (`/`) | **98** | 2.0 s | 2.0 s | 0 ms | 0.003 | 2.1 s | 3.1 s | 358 KiB / 7 req | 2,427 |

Diagnostics that failed or flagged on the chapter page (verbatim `displayValue`s):

| Audit | Score | Value |
|---|---|---|
| `render-blocking-resources` | 0 | Est savings of 870 ms — 1 item: `_astro/mdx-components.D53-omTj.css`, 67,793 bytes |
| `unused-css-rules` | 0 | Est savings of 41 KiB — same file: 42,291 of 67,606 bytes (62.6%) not used by that page |
| `dom-size` | 0 | 3,695 elements (Lighthouse warns above ~1,500; its "Most DOM Elements" offender is `li.toc__item > div.toc__row > a.toc__link > span.toc__label`, i.e. the TOC) |
| `cumulative-layout-shift` | 0.59 | 0.2087 — `layout-shifts`: 0.2080 from `article.prose > p` (the LCP paragraph), 0.0007 from `header.topbar > .topbar__actions` |
| `uses-text-compression` | 0 | Est savings of 326 KiB — **server artifact, see caveats** |
| `server-response-time` | 1 | Root document took 560 ms — **server artifact, see caveats** |
| `bootup-time` | 1 | 0.0 s (JS execution is a non-issue) |
| `mainthread-work-breakdown` | 1 | 1.4 s |
| `unused-javascript`, `unminified-css`, `unminified-javascript`, `font-display`, `modern-image-formats`, `third-party-summary` | 1 / n/a | clean |

Request waterfall for the chapter page (relative `networkRequestTime`, ms) — this is the shape that matters:

```
/                                   Document  start   121  end  2552   305,403 B
_astro/mdx-components…css            Stylesheet  start  630  end  2552    67,793 B
manrope-latin-wght-normal.woff2     Font      start 2029  end  5064    25,025 B
young-serif-latin-400-normal.woff2  Font      start 2029  end  5080    27,181 B
dm-mono-latin-500-normal.woff2      Font      start 2029  end  4937    15,177 B
dm-mono-latin-400-normal.woff2      Font      start 2111  end  5107    15,009 B
BaseLayout…lang.BA7qIzle.js         Script    start 2553  end  5787    21,740 B
favicon.svg                         Other     start 3339  end  7249       434 B
```

Fonts are only *discovered* after the stylesheet has been fetched **and parsed** (they start ~1.4 s after the CSS
request, ~2 s after navigation) and land ~2.5 s after FCP. That single serial hop explains the 0.208 CLS: the LCP
paragraph paints in the fallback (Georgia/system-ui) and is re-laid-out when Manrope arrives (`font-display: swap`).

**Cross-check of the script's font prediction against the real load:** the script predicted 4 woff2 faces / 81,636 B
for the chapter page; Lighthouse fetched exactly those 4 files (82,392 B with headers) — manrope-latin,
young-serif-latin, dm-mono-latin-400, dm-mono-latin-500. On the home page the script predicted 4 faces but only 3
were fetched (65,844 B): DM Mono 400 is not used there, only DM Mono 500. The matcher compares `unicode-range`
against page text and does not resolve `font-weight` per element, so it over-counts families shipped in several
static weights. Treat its font numbers as a small over-estimate.

## 4. Where the bytes are

### 4.1 HTML anatomy (raw bytes / gzip)

| Page | head + theme script | TOC nav | article | pager | search dialog markup | inline `style=""` |
|---|---|---|---|---|---|---|
| home | 895 B / 556 B (0.4%) | **169.2 KiB / 13.4 KiB (82.9%)** | 26.2 KiB / 3.4 KiB (12.8%) | — | 705 B / 370 B (0.3%) | 145 B |
| chapter | 1,001 B / 620 B (0.3%) | **169.3 KiB / 13.4 KiB (56.8%)** | 117.1 KiB / 19.9 KiB (39.3%) | 1.1 KiB / 455 B (0.4%) | 705 B / 370 B (0.2%) | 3.9 KiB |
| reference | 948 B / 583 B (0.3%) | **169.3 KiB / 13.4 KiB (61.8%)** | 92.5 KiB / 18.0 KiB (33.8%) | — | 705 B / 370 B (0.3%) | 0 B |

The TOC is the same 173,340 bytes of markup on all 29 pages. It holds **351 `toc__item` rows** (8 domains, 27
chapters, **316 H2/H3/H4 heading leaves for every chapter in the syllabus**) — ~491 raw bytes per row, and 50
inline copies of the chevron SVG (14,450 raw bytes) emitted by `src/components/Icon.astro`. Everything except the
current domain's branch is server-rendered inside `hidden` lists, so it is shipped but never seen until a click.

### 4.2 Fonts — 12 `@font-face` rules, only 4 faces ever used by a Latin page

| Family | font-weight | display | Subset | File (in `_astro/`) | Bytes | Needed by the audited page text? |
|---|---|---|---|---|---|---|
| Young Serif | 400 | swap | latin-ext | young-serif-latin-ext-400-normal…woff2 | 16.9 KiB | no |
| Young Serif | 400 | swap | latin | young-serif-latin-400-normal…woff2 | 26.4 KiB | **YES** |
| Manrope Variable | 200 800 | swap | cyrillic-ext | *(base64 data-URI inlined **inside** the CSS)* | 2.5 KiB (3,427 B of base64) | no |
| Manrope Variable | 200 800 | swap | cyrillic | manrope-cyrillic-wght-normal…woff2 | 14.2 KiB | no |
| Manrope Variable | 200 800 | swap | greek | manrope-greek-wght-normal…woff2 | 9.2 KiB | no (chapter/home) — **YES on the glossary** |
| Manrope Variable | 200 800 | swap | vietnamese | manrope-vietnamese-wght-normal…woff2 | 8.3 KiB | no |
| Manrope Variable | 200 800 | swap | latin-ext | manrope-latin-ext-wght-normal…woff2 | 14.8 KiB | no |
| Manrope Variable | 200 800 | swap | latin | manrope-latin-wght-normal…woff2 | 24.3 KiB | **YES** |
| DM Mono | 400 | swap | latin-ext / latin | dm-mono-latin-400-normal…woff2 | 9.3 / 14.5 KiB | no / **YES** |
| DM Mono | 500 | swap | latin-ext / latin | dm-mono-latin-500-normal…woff2 | 9.4 / 14.6 KiB | no / **YES** |

Plus 5 legacy `.woff` fallbacks (72.6 KiB on disk) that no browser that supports woff2 will ever request.
Because the fonts are not precompressed by the CDN, the 79.7 KiB of "needed" woff2 is 57–66% of a cold-page
transfer. Two details worth naming:

- `reference/glossary.mdx` contains α, β, δ, κ, λ (16 occurrences) and nothing else outside Latin, yet those five
  letters pull the whole **9,444-byte Manrope Greek subset** on that page (`content/reference/glossary.mdx`).
- DM Mono ships 400 **and** 500; `:not(pre) > code` uses 500 (src/styles/code.css:6), `.toc__num` (toc.css:380),
  `.domain-card__num` (home.css:236), `.signal-table__signal` (signal.css:40). Inline code at 500 is what makes a
  second 14,988-byte mono file necessary on every page.

### 4.3 CSS — one 66.0 KiB (15.5 KiB gzip) blocking file for every page

Source sizes (raw / gzip, minified bundle is 67,606 B / 15,906 B):
`mdx.css` 13,069/3,434 · `layout.css` 12,596/3,120 · `search.css` 10,749/3,091 · `cite.css` 9,984/2,827 ·
`toc.css` 10,467/2,770 · `print.css` 14,575/4,026 → **8,221 B (12.1%) of the shipped bundle, ~2.4 KiB gzip, is
`@media print` + `@page`** · `home.css` 5,852/1,651 (home-only selectors) · `tokens.css` 3,693/1,382 ·
`reading.css` 3,552/1,244 · `base.css` 3,272/1,318 · `prose.css` 2,904/1,076 · `code.css` 2,001/897 ·
`signal.css` 1,850/701.

Lighthouse calls 62.6% of it unused *on one page*; that number is per-page and therefore an over-estimate for a
multi-page site (a rule unused on `/production-integration/reliability/` is needed on the home page), but
`print.css` and `home.css` are unambiguously dead weight on chapter pages.

### 4.4 Client JS — not a problem

One 21,046-byte chunk (7,054 gzip), `BaseLayout.astro_astro_type_script_index_0_lang.BA7qIzle.js`, no imports,
loaded as `type=module` at end of body: bootup-time 0.0 s, `unused-javascript` clean. Sources: toc.ts 12,857 B,
cite.ts 10,143 B, reading.ts 9,432 B, drawer.ts 8,905 B, search.ts 5,868 B, theme.ts 2,391 B (49.6 KiB of TS →
21.0 KiB bundled). Pagefind's UI (`pagefind-ui.js` 124 KiB + `pagefind-component-ui.js` 180 KiB + wasm 60 KiB +
index 908 KiB) is **lazy-loaded on first search open** (src/scripts/search.ts:113-114) and never shows up in the
initial load — leave that alone.

## 5. Prioritized improvements

| # | Change | Exact file(s) to change | Measured / expected effect |
|---|---|---|---|
| **P0** | Ship heading-level TOC rows only for the **current** chapter (prune `kind === 'heading'` nodes of other chapters; keep the contract markup, `data-toc-id`, twisties and `ccdvp:toc:v1` behaviour intact) | `src/lib/toc.ts` (a `pruneHeadings(nodes, currentId)` filter next to `buildToc`) consumed by `src/components/Toc.astro`; `src/layouts/BaseLayout.astro` already passes `currentId` | **Measured** by deleting the other chapters' heading `<li>`s from the built HTML: nav 173,340 → 35,996 raw, gzip 13,752 → 3,125; chapter HTML 305,214 → 167,748 raw, gzip 36,966 → 26,072 (**−29% of the largest request, −10.6 KiB**), DOM 3,695 → ~560 nodes. × 29 pages ≈ 300 KiB of gzip saved site-wide; fixes `dom-size` and shrinks the `render-blocking`/LCP hop. *Tradeoff:* expanding a non-current chapter shows chapters only; its headings appear once you navigate there. If that is unacceptable, the behaviour-preserving variant is per-domain TOC JSON fetched on twisty-click (same two files + `src/scripts/toc.ts`). |
| **P1** | Preload the two faces above the fold so fonts stop waiting for the stylesheet: `<link rel="preload" as="font" type="font/woff2" crossorigin>` for Young Serif latin and Manrope latin, placed in `<head>` **before** the stylesheet link so the preloader scanner starts them immediately | `src/layouts/BaseLayout.astro` (head, ahead of the existing `<link rel="stylesheet">`), using Astro asset imports (`import youngSerif from '@fontsource/young-serif/files/young-serif-latin-400-normal.woff2?url'`) so the hashed name is not hard-coded | The waterfall above starts fonts at 2,029 ms and ends them at ~5,070 ms; starting them with the CSS (630 ms) removes the serial hop. Directly targets the **0.208 CLS** on chapter pages (layout-shift is entirely the LCP paragraph being re-flowed when Manrope lands) and the 2.1 s LCP. |
| **P2** | Get `print.css` out of the render-blocking bundle and load it as `media="print"` (drop the `@import`, link the asset with `media="print"`) | `src/styles/global.css:10` (`@import "./print.css";`) and `src/layouts/BaseLayout.astro` (`<link rel="stylesheet" href={printCss} media="print">` via a `?url` import) | −8,221 raw / ~2.4 KiB gzip (≈15% of CSS gzip) from every screen load, and shortens the file Lighthouse blames for 870–1,020 ms of render-blocking time. Verify in the built CSS that the print rules are gone from `mdx-components.*.css`; note a `?url` asset is copied verbatim, so keep print.css itself tidy (it is already hand-minified-friendly). |
| **P3** | Stop shipping faces no page can use: import latin-only subsets and write the four `@font-face` rules by hand (pointing at `@fontsource*/files/*.woff2`, keeping each `unicode-range`), instead of the package entry CSS | `src/styles/tokens.css:2-5` (the four `@import '@fontsource…'` lines) — the packages do ship `latin-400.css` / `latin.css` for Young Serif and DM Mono, and `files/manrope-latin-wght-normal.woff2` for Manrope | Font files in `dist/_astro/` go from 240,060 B to the 81,636 B actually fetched: **−158,424 B**, made of 74,404 B of legacy `.woff` (5 files) and 84,020 B of non-Latin woff2 (young-serif-latin-ext 17,268 · manrope latin-ext 15,120, cyrillic 14,500, greek 9,444, vietnamese 8,520 · dm-mono latin-ext 9,552 + 9,616). It also removes the **3,427 bytes of base64 font that currently sit inside the render-blocking stylesheet** (Vite inlined the 2,552-byte `manrope-cyrillic-ext` file because it is under `assetsInlineLimit`) — that part matters even though the browser never fetches it. If hand-writing `@font-face` is too invasive, the one-line alternative is `vite: { build: { assetsInlineLimit: 1024 } }` in `astro.config.mjs`, which only ejects the base64 blob. |
| **P4** | One chevron sprite instead of 50 inline SVGs in the TOC (render an SVG `<symbol>` once, then `<use href="#i-chevron">`) | `src/components/Icon.astro` (a sprite mode) and `src/components/Toc.astro` (call site); `src/styles/toc.css` `.toc__twisty svg` | −14,450 raw / −411 gzip measured on a chapter page (the 50 SVGs are ~150 DOM nodes). P0 is what removes the other ~3,135 nodes; this is the cheap remainder. Keep the `.toc__twisty` / `aria-expanded` contract exactly as documented. |
| **P5** | Ship one Shiki theme instead of two identical ones: `themes: { light: 'github-dark', dark: 'github-dark' }` + `defaultColor: false` writes `--shiki-light` **and** an identical `--shiki-dark` on every token span — measured over the whole build: 2,909 shiki `style` attributes, 150,423 bytes, **2,905 of them byte-identical light vs dark** | `astro.config.mjs:14-17` (`shikiConfig`: single `theme: 'github-dark'`, drop `defaultColor: false`) and `src/styles/code.css:16-27` (the `html[data-theme='dark'] .astro-code` switch and the `--shiki-*-bg` overrides then become unnecessary) | Halves those attributes: **−75 KiB of raw HTML site-wide** (chapter page: 3,915 shiki bytes of its 3,955 inline-`style` bytes → ~1,950 B; ~0.5 KiB gzip per page). Small, but zero-risk, and it deletes a theme switch that today only duplicates itself. Re-check code colours in both themes afterwards. |
| **P6** *(optional, lowest value)* | The glossary's five Greek letters (α ×4, β ×4, κ ×3, λ ×3, δ ×2 — all in prose/table math, e.g. "written 1 − β", "κ = (Po − Pe) / (1 − Pe)") are the only non-Latin text on the site, and they make that one page fetch the 9,444-byte **Manrope Greek** subset. Transliterating them (`alpha`, `kappa`) recovers it; moving them into inline `<code>` avoids the extra file too but renders the glyph from a system fallback, and replacing the math with `1 - beta` prose would be worse content for a study guide. | `content/reference/glossary.mdx` | −9,444 B on `/reference/glossary/` only (measured: the only audited page needing a 5th face). Keep the notation unless P3 removes the subset anyway. |
| **P7** | Split home-only CSS out of the global bundle so chapters don't ship it (Astro scopes `<style>` in the page that uses it) | `src/styles/home.css` → `src/pages/index.astro` component `<style>` (or a home-only `import`), and `src/styles/global.css:11` | −5,852 raw / ~1.65 KiB gzip from the 28 non-home pages. Do it together with P2 as one "CSS scoping" pass. |

Suggested order: P0 → P1 (they are the only two that move lab scores), then P2/P3/P7 (byte clean-up), then P4/P5/P6.

## 6. Caveats and things deliberately *not* reported as problems

- **Local server, not GitHub Pages.** `python3 -m http.server` sends no `Content-Encoding` and no
  `Cache-Control`, so `uses-text-compression` (326 KiB "wasted") and part of `uses-long-cache-ttl` are pure
  server artifacts, and `total-byte-weight` (467 KiB) is *uncompressed* bytes. The realistic transfer figure for
  the chapter page on Pages is the script's 138.6 KiB estimate, and the 560 ms "server response time" is
  Python's single-threaded handler, not a CDN. Re-run against a compressed host (`astro preview`, nginx with
  gzip/brotli, or the deployed Pages URL) before quoting total-byte-weight to anyone.
- **One Lighthouse run per page, lab-only.** No `--throttling-method` override, so CPU/network are simulated
  defaults; treat the 83 vs 98 delta as directional. The script numbers, not the Lighthouse ones, are the
  stable measurements.
- **JS is fine.** 7.1 KiB gzip for all behaviour, 0.0 s bootup, no unused-JS warning. Do not add a bundler
  step or lazy-load the six `init*()` modules to chase a number that is already green.
- **No images, no third-party, no analytics.** `modern-image-formats`, `offscreen-images`,
  `third-party-summary` are all trivially clean; `favicon.svg` (434 B) is the only extra request.
- **CSS minification is already on** (`unminified-css`/`unminified-javascript` clean) and hashed `_astro` files
  are immutable-cache friendly.
- `src/content.config.ts`'s `CCDVP_ONLY` filter was not used here — the audit needs all three page types and the
  real `_astro/` graph in one build. It was one build (4 s), not repeated.

## 7. Notes for whoever acts on this

- `astro check` on the current tree: 0 errors, 0 warnings, 1 pre-existing hint outside this audit's files —
  `src/scripts/drawer.ts:124` uses the deprecated `MediaQueryList.addListener` signature.
- `package.json` still depends on `@fontsource-variable/inter`, `@fontsource-variable/jetbrains-mono` and
  `@fontsource-variable/source-serif-4`, which no CSS imports any more (Gelato uses Young Serif / Manrope / DM
  Mono). They cost nothing at runtime — no files reach `dist/` — but `docs/ARCHITECTURE.md` still documents
  Inter, Source Serif 4 and JetBrains Mono as *the* fonts, which will mislead the next contributor into
  re-importing ~120 KiB of fonts. Fix the contract text (and optionally `package.json`) when P3 runs.
- Everything in this audit lives in `scripts/size-report.mjs`; re-run it after each change and diff the §2 table.
