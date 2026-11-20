# Architecture contract

Static Astro 7 + MDX site, deployed to GitHub Pages at `/<repo>/`. No UI framework: client behavior is plain
TypeScript modules in `src/scripts/`, bundled by Astro. Every page is a real static HTML file, so refresh and
deep links work on GitHub Pages without a 404 fallback.

## Layout of the repo

```
content/                      MDX chapters (outside src). One file per skill + reference pages.
  00-introduction.mdx         kind: intro (rendered on the home page)
  02-production-integration/01-reliability.mdx   kind: skill, skill: "2.1", slug: reliability
  reference/<slug>.mdx        kind: reference
research/
  exam-guide.md               verified official blueprint
  PACKET_FORMAT.md            how research packets and citations are written
  packets/<slug>.md           research notes per skill
  citations/<slug>.yaml       verbatim-quote citations per skill (rendered on the site)
  sources.yaml                generated aggregate (scripts/build-sources.mjs)
  coverage-matrix.md, fact-check-log.md
src/
  data/syllabus.ts            DOMAINS / skills (official titles, objectives, stable slugs)
  lib/site.ts                 url(path) — ALWAYS use for internal links (handles base path)
  lib/toc.ts                  getToc(): TocNode[] built from syllabus + MDX headings
  lib/citations.ts            getCitations(stem): Citation[]
  lib/mdx-components.ts       components injected into every MDX file (no imports needed in MDX)
  layouts/BaseLayout.astro    page shell (DOM contract below)
  pages/index.astro           home; pages/[...path].astro skill + reference pages
  components/                 Toc, SearchDialog, CitePopover, SourceList, mdx/*
  scripts/main.ts             imports and calls each init*() once
  styles/global.css           @imports one css file per concern (ownership below)
tests/e2e/                    Playwright
scripts/                      build-time checks (links, citations, quotes)
```

URLs: skill `/<domain-slug>/<skill-slug>/`, reference `/reference/<slug>/`, home `/`. Trailing slash always.
Heading ids come from Astro's github-slugger (`## Retry budgets` → `#retry-budgets`).

## DOM contract (BaseLayout.astro)

| Selector | Element | Notes |
|---|---|---|
| `html[data-theme="light"\|"dark"]` | root | set before paint by inline script; key `ccdvp:theme` |
| `body[data-current-id]` | body | TocNode id of the current chapter, e.g. `c-reliability`; empty on home |
| `body[data-base]` | body | base URL with trailing slash, e.g. `/repo/` |
| `.skip-link` | a | first focusable element |
| `#progress-bar` inside `.progress` | div | width = % of article read |
| `header.topbar` | header | sticky, height `--topbar-h` (52px) |
| `#toc-toggle` | button | `aria-controls="toc-panel"`, `aria-expanded` |
| `.topbar__title`, `.topbar__title-rest`, `#topbar-section` | | section label hidden < 640px |
| `#search-open`, `#theme-toggle` | button | `.theme-icon--sun` / `.theme-icon--moon` |
| `.shell` | div | grid: toc-panel / main / onpage |
| `#toc-panel.toc-panel[data-state="open"\|"closed"]` | aside | sidebar ≥1024px, drawer below |
| `.toc-panel__head`, `.toc-controls__btn[data-toc-action="collapse-all"\|"expand-current"\|"expand-all"]`, `#toc-close` | | |
| `nav.toc` | nav | contains `<Toc>` |
| `#toc-backdrop.toc-backdrop[hidden]` | div | drawer backdrop |
| `main#main.main` > `article.prose[data-pagefind-body]` | | chapter content |
| `.chapter-head`, `.chapter-head__eyebrow`, `.chapter-head__title`, `.chapter-head__num`, `.chapter-head__meta`, `.status.status--draft\|fact-checked\|pending`, `details.objective`, `.objective__src`, `.pending` | | chapter header |
| `.home-head`, `.home-head__title`, `.home-head__lede`, `#resume-link.resume[hidden]`, `.domain-map`, `.domain-card`, `.domain-card__title/__n/__w/__skills` | | home page |
| `nav.pager` > `a.pager__link--prev/--next` > `.pager__dir` + `.pager__label` | | |
| `aside.onpage` > `.onpage__title`, `ul.onpage__list` > `li.onpage__item--h2/--h3` > `a[data-onpage-link=slug]` | | ≥1280px only |
| `#back-to-top.back-to-top[hidden]` | button | |
| `dialog#search-dialog` | | SearchDialog.astro |
| `#cite-pop` | div | CitePopover.astro |

## TOC markup (Toc.astro, recursive)

```html
<ul class="toc__list" data-depth="0">
  <li class="toc__item" data-toc-id="d-2" data-depth="0" data-kind="domain">
    <div class="toc__row">
      <button class="toc__twisty" type="button" aria-expanded="false" aria-controls="toc-sub-d-2"
              aria-label="Expand Production Integration…"><svg chevron/></button>
      <a class="toc__link" href="…" data-toc-link="d-2">
        <span class="toc__num">2</span><span class="toc__label">Production Integration…</span><span class="toc__meta">20%</span>
      </a>
    </div>
    <ul class="toc__list" id="toc-sub-d-2" data-depth="1" hidden> … </ul>
  </li>
</ul>
```

- Leaf nodes render a `<span class="toc__twisty-spacer">` instead of the button.
- Server render: ancestors of the current chapter (`currentId`) and the current chapter itself are expanded
  (no `hidden`, `aria-expanded="true"`); current chapter link has `aria-current="page"`; its `li` has
  `.is-current`; its ancestors have `.is-ancestor`.
- Client (`toc.ts`): active heading → link gets `.is-active`, its ancestor `li`s get `.is-active-path`.
- Chapter status `pending` → `.toc__link--pending` (muted, still a link).
- Explicit user collapse/expand choices persist in localStorage key `ccdvp:toc:v1` as `{ [tocId]: true|false }`.

## Components in MDX (no import needed)

```mdx
Claude returns HTTP 529 when the API is overloaded.<Cite id="F3" />  Two sources: <Cite id="F3 F7" />

<Callout type="mistake" title="Retrying a refusal">Markdown body.</Callout>     type: mistake | version | note
<ExamLens>Markdown body: the decision pattern a scenario may test.</ExamLens>   (labeled editorial inference)
<SelfCheck question="Why can HTTP 200 still be a failure?">Markdown answer.</SelfCheck>
<Figure caption="Caption sentence." >  …any content: Flow, Sequence, table, image …  </Figure>
<Flow steps={["Query", "ACL filter", {label: "Rerank", note: "top 50 → 8"}]} />          optional direction="vertical"
<Sequence actors={["Agent", "Step log", "Payments API"]}
          messages={[{ from: 0, to: 1, label: "record intent key=k1" },
                     { from: 0, to: 2, label: "charge(k1)" },
                     { at: 0, note: "process crashes", tone: "bad" },
                     { from: 2, to: 0, label: "200 OK", dashed: true }]} />
```

`Cite` renders `<sup class="cite-group"><a class="cite" href="#src-F3" data-cite="F3" aria-label="Source 3">[3]</a></sup>`.
`SourceList` renders, at chapter end, `<section class="sources"><h2 id="sources">Sources</h2><ol>` with
`<li id="src-F3" class="source" value="3">` per citation. `cite.ts` opens `#cite-pop` populated from that `li`.

## Citations data

`research/citations/<slug>.yaml` → `Citation { id, n, claim, tag, url, title, source, quote, accessed, version_note? }`.

## CSS ownership (one file per concern; all use tokens from tokens.css)

| File | Owner concern |
|---|---|
| tokens.css | colors, fonts, sizes (light + dark) |
| base.css | reset, body, links, focus ring, skip link, .sr-only, icon-btn |
| layout.css | topbar, shell grid, main, onpage rail, pager, home + chapter-head, status pills, pending |
| prose.css | article typography, headings, lists, tables, blockquote, hr, details.objective |
| code.css | inline code, pre/shiki, copy button placement |
| toc.css | toc-panel (sidebar + drawer), backdrop, toc tree, controls |
| reading.css | progress bar, back-to-top, heading anchor links, resume link, search dialog |
| cite.css | .cite, .sources, #cite-pop |
| mdx.css | Callout, ExamLens, SelfCheck, Figure, Flow, Sequence |
| print.css | print rules |

## Design tokens (owned by the orchestrator; tokens.css implements exactly these)

Light: `--bg #FAF9F6` `--bg-subtle #F3F1EC` `--surface #FFFFFF` `--ink #1F2328` `--ink-muted #5B6169`
`--border #E3DFD6` `--border-strong #CFC9BC` `--accent #1F6F6B` `--accent-ink #17524F` `--accent-soft #E3F0EE`
`--code-bg #F4F2EE` `--warn #8A5210` `--warn-soft #FBF1E2` `--bad #A33A2B` `--bad-soft #FBEAE7` `--focus #2A7DE1`
`--backdrop rgba(20,22,26,.38)` `--shadow 0 8px 28px rgba(20,22,26,.14)`.

Dark: `--bg #15181C` `--bg-subtle #1B1F24` `--surface #1E2329` `--ink #E6E3DC` `--ink-muted #A3A9B1`
`--border #2E343B` `--border-strong #3D444C` `--accent #5FB8B0` `--accent-ink #8FD3CC` `--accent-soft #1D3533`
`--code-bg #1B1F24` `--warn #E0A458` `--warn-soft #2E2618` `--bad #E58A7C` `--bad-soft #33201D` `--focus #6AA8F0`
`--backdrop rgba(0,0,0,.55)` `--shadow 0 8px 28px rgba(0,0,0,.5)`.

Fonts (bundled via @fontsource-variable, OFL): `--font-serif "Source Serif 4 Variable", Georgia, serif` (site
title, H1, H2 only) · `--font-sans "Inter Variable", system-ui, -apple-system, "Segoe UI", sans-serif` (body,
UI, H3/H4) · `--font-mono "JetBrains Mono Variable", ui-monospace, "DejaVu Sans Mono", monospace` (all code; never serif).

Sizes: body 17px / line-height 1.65; `--measure 72ch` max width of `.prose`; `--topbar-h 52px`;
`--sidebar-w 300px`; `--onpage-w 220px`; radius 8px; touch targets ≥ 44px.
Breakpoints: mobile < 640, tablet 640–1023 (drawer), desktop ≥ 1024 (sidebar), wide ≥ 1280 (onpage rail).

## Build

`pnpm build` = `astro build && pagefind --site dist`. `BASE_PATH=/repo/` for project pages.
Checks: `pnpm check` (astro check), `node scripts/check-links.mjs dist`, `node scripts/check-citations.mjs`,
`pnpm test:e2e` (Playwright, mobile + desktop projects).
