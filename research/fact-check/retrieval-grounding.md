# Fact-check: 2.4 Retrieval and Knowledge Grounding at Scale
Checked: 2026-11-19 · Reviewer: Gemini 4 Hydrogen (High)
## Summary
- Claims checked: 86 `<Cite>` claim spans across 35 original citations (plus 1 uncited claim newly cited); 77 supported as written, 9 partial/overstated or mis-scoped fixed, 0 unsupported removed.
- Citations added: 7 (`F37`–`F43`).
- Code blocks checked: 1 Python pseudocode block (checked with `ast.parse` and verified against `voyageai` Python SDK and Anthropic Messages API docs; 1 SDK attribute bug fixed: `ranked.data` → `ranked.results`).

## Changes
- Indexed retrieval (RAG) definition (`How evidence reaches the prompt`) — `F1` only describes runtime vector search and prompt injection, not chunking/indexing → added `F37` from the same article covering document splitting (`F37`, `F1`).
- Hybrid agentic strategy (`How evidence reaches the prompt`) — "Anthropic recommends a hybrid" overstated `F10` ("might employ a hybrid strategy") → reworded to "In some settings, effective agents use a hybrid strategy" (`F10`).
- Contextual Retrieval context-loss sentence (`Indexing and contextual retrieval`) — uncited factual claim about chunks losing context → linked to `F37` (`F37`).
- Embedding strategy & Voyage `truncation` (`Indexing and contextual retrieval`) — added a concise embedding-selection recommendation for objective coverage; "silently truncated" and lowercase `true` did not match Python SDK `True` and `F21` quote → updated to `True`/`False` and removed "silently", plus aligned "all embedding models it tested" (`F34`, `F21`).
- Reranking definition (`Candidate retrieval and ranking`) — "ensuring that only the most relevant chunks" sounded like a guarantee vs `F36` ("to ensure") → reworded to "filters the merged candidate set so that only the most relevant chunks pass to the model" (`F36`).
- Worked example (`Candidate retrieval and ranking`) — leaked internal phrase "Worked example from the packet" and said "custom citation blocks" instead of `search_result` blocks → reworded to "**Worked example (illustrative, not a benchmark):**" and "`search_result` blocks with citations enabled".
- Python pseudocode (`Candidate retrieval and ranking`) — `voyage.rerank(...)` returns a `RerankingObject` with `.results`, not `.data` → changed `ranked.data` to `ranked.results` (`F27`).
- Document block fields & citation location types (`Grounding contracts: citations and source attribution`) — `F11` only covered uniform citation enablement, not block schema/`title`/`context`, and `F12` did not name `char_location`/`page_location`/`content_block_location`; also repeated 0-indexed/1-indexed conventions across two consecutive sentences → added `F38`–`F43`, tightened the location-type explanation, and consolidated indexing/bounds (`F11`, `F12`, `F31`, `F38`–`F43`).
- Post-generation quote verification (`Uncertainty declaration and confidence signals`) — phrased mandatory retraction without noting the optional post-generation verification step in `F19` → aligned to "you can also instruct Claude to verify each claim after generating a response and retract any claim that lacks a supporting quote" (`F19`).
- Diagnostic attribution rule (`Decision criteria`) — `<Cite id="F22" />` was attached to the inference sentence "High recall with low groundedness points downstream…", which `F22` does not state → removed `F22` from that sentence (retained `F22` where `1 minus recall@20` is defined).
- BM25 failure mode callout (`Failure modes and recovery`) — "exists precisely for queries with unique identifiers" overstated `F5` ("particularly effective for") → changed to "is particularly effective for" (`F5`).
- Editorial polish — bolded and defined **Retrieval-Augmented Generation (RAG)**, **Hybrid retrieval**, **BM25**, **`search_result` blocks**, and **calibrated product signal** on first use, and framed the web search→fetch pattern as a common pattern.

## Remaining concerns
- None: all 42 citations pass `verify-quotes.mjs` against live fetched sources on 2026-11-19, `check-citations.mjs` passes, the Python pseudocode parses cleanly with `ast.parse`, and `astro build` completes cleanly.
