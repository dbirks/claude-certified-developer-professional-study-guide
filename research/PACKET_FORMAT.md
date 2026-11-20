# Research packet format

Each skill has two files:

- `research/packets/<skill-slug>.md` — the research notes a drafting worker turns into the chapter.
- `research/citations/<skill-slug>.yaml` — one entry per citable fact, each with a **verbatim quote** copied from
  the source page. The site renders these as tap-to-open citation popovers, and `scripts/verify-quotes.mjs`
  fetches every URL and checks the quote appears on the page. A quote that is not verbatim fails the build check.

A drafting worker writes the chapter **only** from these two files. Anything not in them will not appear.

## citations yaml

```yaml
- id: F1                       # unique within the file; chapter cites it as <Cite id="F1" />
  claim: "Plain-language statement the chapter will make (our words)."
  tag: FACT                    # FACT documented behavior | REC official recommendation | VER version-sensitive | STD standard/spec
  url: https://platform.claude.com/docs/en/build-with-claude/handling-stop-reasons   # exact deep link; add #anchor if the page has one
  title: "Handling stop reasons"           # page title as shown
  source: anthropic-docs       # anthropic-docs | anthropic-engineering | anthropic-research | claude-code-docs | mcp-spec | standard | other
  quote: "Exact sentence(s) copied character-for-character from the page, 1–3 sentences, max ~60 words."
  accessed: 2026-11-19
  version_note: "Only for VER: which model/product/date this applies to."   # optional
```

Quote rules:
- Copy the text exactly as rendered on the page (keep wording, punctuation, capitalization). Do not paraphrase,
  join non-adjacent sentences, or add ellipses inside the quote. Use a shorter exact span instead.
- Choose the sentence that most directly supports the claim. For a table row, quote the row's cell text joined
  by " | ".
- Code identifiers in the quote are fine (e.g. `stop_reason`), but copy them as plain text without backticks
  unless the page text literally shows them as code (then still omit the backticks).
- If you cannot find a verbatim sentence supporting a claim, either drop the claim or keep it in the packet
  under **Unresolved**. Never invent a quote.
- Prefer official Anthropic sources: platform.claude.com/docs, code.claude.com/docs, anthropic.com/engineering,
  anthropic.com/research, docs.claude.com, support.claude.com; then modelcontextprotocol.io and standards
  (opentelemetry.io, owasp.org, nist.gov, sre.google). Secondary sources only for discovery, not citation.

## Packet sections (in this order)

1. `# <ID> <Official skill title>` then the official objective text (copy from `research/exam-guide.md`).
2. **Scope map** — each comma-separated sub-objective in the official text → which packet section covers it.
3. **Core facts** — bullet list of the claims, each ending with its citation id, e.g. `(F3)`. Every factual or
   API-specific statement must have a citation id that exists in the yaml.
4. **Exact API / config details** — code-ready specifics verified against current docs: field names, enum values,
   HTTP codes and error `type` strings, headers, CLI flags, settings keys, SDK option names, beta headers, limits,
   each with a citation id. If a detail could not be verified, say so; never guess syntax.
5. **Practitioner reasoning** — decision criteria, trade-offs, failure modes and recovery. Mark as `[INFERENCE]`
   when it is engineering reasoning rather than a documented statement.
6. **Worked example(s)** — at least one concrete, original scenario with numbers or code the chapter can use.
   Say whether code is runnable or pseudocode, and which SDK/version. Python preferred; TypeScript fine.
7. **Diagram spec** — if useful: type (flow | sequence | tree), nodes/actors and edges/messages in plain text,
   and a one-sentence caption.
8. **Exam lens** — 2–4 decision patterns a scenario item could test, labeled as editorial inference.
   Never invent or reproduce real exam items. The three official sample items (guide §7) may be referenced.
9. **Common mistakes** — only meaningful traps.
10. **Self-check** — 2–3 original questions with short answers.
11. **Unresolved** — anything you could not verify, pages that failed to load, conflicting statements.

Aim for 15–35 citation entries per skill and a 1,500–3,500 word packet. Dense and specific; no filler.
Today is 2026-11-19. Docs change often: fetch pages, never rely on memory for API details.
No exam dumps, no candidate-reported questions.
