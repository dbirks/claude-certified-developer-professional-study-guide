# 2.4 Retrieval and Knowledge Grounding at Scale

Official objective (November 2026 exam guide):

> Evaluating retrieval architecture for knowledge-grounded production applications, including agentic search versus RAG tradeoffs, chunking and embedding strategy, hybrid search, and reranking, and designing grounding practices such as source citation, uncertainty declaration, and confidence signals, and diagnosing retrieval-quality failures by stage.

## Scope map

- Evaluating retrieval architecture; agentic search versus RAG tradeoffs → **Architecture choices and trade-offs**.
- Chunking and embedding strategy → **Indexing and contextual retrieval**.
- Hybrid search and reranking → **Candidate retrieval and ranking**.
- Source citation → **Grounding contracts and citations**.
- Uncertainty declaration and confidence signals → **Grounding contracts and confidence**.
- Diagnosing retrieval-quality failures by stage → **Stage-by-stage diagnosis**.

## Core facts

- In conventional RAG, a vector database retrieves relevant chunks by semantic similarity and adds them to the model prompt. Chunk size, boundaries, and overlap affect retrieval. Anthropic's tests found Voyage and Gemini embeddings particularly effective. (F1, F4, F34)
- Contextual Retrieval prepends chunk-specific explanatory context before embedding the chunk and creating the BM25 index. Anthropic's contextualizer generated context usually 50–100 tokens. (F2, F26)
- Anthropic measures 1 minus recall@20 as relevant documents that fail to enter the top 20 chunks. (F22) Contextual embeddings reduced that retrieval failure rate from 5.7% to 3.7% (35%); contextual embeddings plus contextual BM25 reduced it to 2.9% (49%). In the tested setup, reranking those contextual retrieval candidates reduced failure from 5.7% to 1.9% (67%). These are results for Anthropic's datasets and setup, not a production guarantee. (F3, F6)
- Hybrid retrieval combines dense semantic retrieval with BM25 lexical retrieval, then merges and deduplicates ranked candidates with rank fusion. Dense retrieval captures semantic similarity; lexical retrieval helps exact identifiers, error codes, names, and technical strings. (F5, F25)
- Reranking filters initial search candidates so fewer, more relevant chunks reach the answer model. In Anthropic's test setup, contextual embeddings, contextual BM25, and reranking lowered top-20 retrieval failure by 67%. Reranking adds a runtime step with latency and cost tradeoffs. (F6, F7, F36)
- Claude Code is an Anthropic example of agentic, just-in-time retrieval: it uses filesystem references and tools such as glob, grep, and Bash to navigate and read context on demand; its hybrid approach places `CLAUDE.md` content up front and explores files just in time. Anthropic says this can avoid stale indexing and complex syntax trees. (F8, F9)
- Agentic exploration can progressively disclose context and avoid indexing everything in advance, but runtime exploration is slower and needs well-designed tools and heuristics. (F32) Anthropic recommends a hybrid where useful context is retrieved up front and the agent can explore further; the right autonomy depends on task. (F10)
- Messages API document citations require a `document` block and `citations: {enabled: true}` on every document in the request, or none. Plain text citations use zero-based character ranges, PDF citations use one-based page ranges, and custom-content citations use zero-based content-block ranges. End indices are exclusive. Citations cannot cite images. (F11, F12, F31)
- A custom-content document uses `source.type: "content"`; each provided text block is a citation unit, and Claude does no additional chunking. Use this when your retrieval chunks need controlled citation boundaries. (F13)
- Claude's `search_result` content blocks let an application pass retrieved corpus content with a source identifier and title; the model can automatically cite those supplied sources when citations are enabled. This is a natural interface for a custom search/RAG tool. (F14)
- The web search tool cites results automatically and supports current web discovery. Web fetch retrieves full content for selected URLs; its citations are optional and off by default, enabled using `citations: {enabled: true}`. Search then fetch is useful when a search snippet identifies a page but the answer needs a specific passage. (F16, F17)
- Anthropic's hallucination guidance says to explicitly permit Claude to say “I don't know,” ground factual work in direct quotes, and verify claims with citations; if a claim lacks supporting text, retract it. These reduce risk but do not eliminate hallucination. (F18, F19)
- Voyage recommends `input_type="query"` and `input_type="document"` for retrieval embeddings. Over-length inputs are truncated by default, so chunk size must account for the selected model's context limit. (F20, F21)

## Exact API / config details

### Messages API source and citation contracts

- A document block has `type: "document"`, a `source` object (for example `{"type":"text","media_type":"text/plain","data":"..."}`), optional `title` and `context`, and `citations: {"enabled": true}`. `context` and `title` are passed to the model but are not cited as source text. Enable citations consistently across all documents in one request. (F11)
- Citation `type` values for user-provided documents are `char_location`, `page_location`, and `content_block_location`. `document_index` is zero-based; char indices are zero-based with exclusive end; page numbers are one-based with exclusive end; content-block indices are zero-based with exclusive end. (F12)
- Custom content uses `source: {"type":"content","content":[{"type":"text","text":"..."}]}`; no further chunking occurs. Use one source text block per independently citable retrieved chunk when fine-grained references are needed. (F13)
- `search_result` requires `type`, `source`, `title`, and `content` (an array of non-empty text blocks); `citations` is optional and uses an `enabled` boolean. Citations are disabled by default for these blocks, and all search results in a request must use the same setting. For Messages API, these may appear in a tool result or directly in a user message. Citations are off by default for search_result blocks; set them consistently across results. (F14, F33, F35)
- Citations and strict structured outputs cannot be combined: enabling document or search-result citations together with `output_config.format` (or deprecated `output_format`) returns HTTP 400. (F23)

### Server search and fetch

- The documented web search tool versions are `web_search_20250305`, `web_search_20260209` (dynamic filtering), and `web_search_20260318` (response-inclusion control). (F28) Citation locations are `web_search_result_location`; citation fields include `url`, `title`, `encrypted_index`, and `cited_text`. (F16)
- Web fetch versions change frequently; the current docs identify `web_fetch_20260318`. (F29) Unlike web search, web-fetch citations are opt-in: set `citations: {enabled: true}`. (F17)
- Voyage embedding retrieval option: `input_type` accepts `query` or `document`. Its `truncation` option defaults to `true`; over-length inputs are truncated unless truncation is disabled. Confirm model names and limits against Voyage's live docs before implementation because these are provider-version-sensitive. (F20, F21)
- Voyage's reranker client method is `rerank()`, with `query`, `documents`, `model`, and optional `top_k` / `truncation`. Document count and token limits are model-specific. (F27)

## Practitioner reasoning

- **Choose retrieval by data shape and freshness.** [INFERENCE] Prefer direct context for small, stable corpora that safely fit the usable context budget. Prefer indexed RAG for large corpora, repeatable low-latency lookup, and data that benefits from predictable filtering. Prefer agentic search when useful evidence is found through exploration (codebases, directories, linked pages, queryable data) or the corpus changes too quickly for a costly index refresh. A hybrid supports fast common cases plus a tool loop for gaps. Anthropic documents a roughly 200,000-token direct-context rule of thumb in its Contextual Retrieval article, but this is not a universal safe limit; usable context, distractors, and task quality matter. (F10, F24)
- **Tune chunk boundaries empirically, not by adopting one magic token count.** [INFERENCE] Preserve semantic units (paragraphs, headings, code symbols, table rows), attach stable document and section identifiers, and evaluate chunk size and overlap against real questions. Too-small chunks lose referents and relationships; too-large chunks dilute retrieval and consume prompt budget. Contextual prefixes can restore missing references for retrieval without changing the original evidence that should be quoted. Anthropic's results support experimenting with chunk size, boundaries, overlap, and context count. (F2, F4)
- **Combine retrievers where query types differ.** [INFERENCE] Dense search is a good default for paraphrase and concept queries; BM25 is important for exact strings such as `ERR-4017`, symbols, product IDs, and version names. Fuse ranks or normalize scores rather than assuming vector cosine and BM25 raw scores are comparable. Rerank the union after ACL and metadata filtering, not before, so forbidden candidates cannot leak into ranking or prompts. (F5, F6)
- **Treat metadata and authorization as retrieval correctness.** [INFERENCE] Apply tenant, document ACL, lifecycle status, locale, and effective-date filters before candidate generation where possible. Re-check authorization at fetch time; an index can retain stale grants or stale document snapshots. Store source version, updated-at, and content hash so answers can cite and audit the exact revision used. A document existing somewhere in the corpus is not proof that the query could retrieve it, that filters admitted it, or that its evidence reached Claude.
- **Measure each stage, not just answer quality.** [INFERENCE] Maintain a labeled query set with expected evidence IDs and ACL context. Measure recall@k after candidate retrieval (did any relevant evidence enter top k?) and precision@k (how much of top k is relevant); evaluate after reranking as well as before. Track evidence coverage in the assembled prompt and answer groundedness separately. High recall with low groundedness points downstream; low recall points upstream. Anthropic's reported metric is 1 minus recall@20, not answer accuracy. (F3)
- **Use confidence as a calibrated product signal, not a model vibe.** [INFERENCE] Give downstream consumers an evidence-based signal: retrieval coverage, reranker margin or calibrated relevance band, evidence freshness, source agreement, and citation-validation status. A raw similarity score is neither probability of correctness nor answer confidence. Calibrate bands offline against adjudicated examples; on low evidence, conflicting sources, missing citations, or stale evidence, ask Claude to qualify, retrieve again, or abstain. Prompt permission to abstain, but enforce high-stakes policy outside the model. (F18, F19)

### Stage-by-stage diagnosis

| Stage | Symptom and diagnostic | Recovery |
|---|---|---|
| Query | User's natural-language wording misses the corpus vocabulary; inspect query normalization, expansion, identifiers, language, and filters. | Add targeted query rewrites or lexical alternatives; preserve exact strings. [INFERENCE] |
| Filter | Relevant document exists but is excluded by tenant, ACL, date, locale, or status predicate. | Inspect filter decisions with principal and policy version; repair metadata or authorization mapping. [INFERENCE] |
| Retrieve | Evidence is eligible but absent from vector/BM25 candidates; report recall@k by query cohort and retriever. | Tune chunking/embedding, include BM25, contextualize chunks, increase candidate k, rebuild stale index. [INFERENCE] (F3–F5) |
| Rerank | Evidence entered candidate set but fell below cutoff; compare pre/post-rerank rank and relevance labels. | Adjust reranker/query formulation or top-k cutoff; test model and latency/cost trade-off. [INFERENCE] (F6, F7) |
| Context | Candidate is selected but omitted, truncated, duplicated, badly ordered, or detached from useful metadata in prompt assembly. | Log the actual evidence IDs and text spans sent to Claude; cap redundancy and preserve source, version, and chunk boundaries. [INFERENCE] |
| Answer | Evidence reached Claude but the claim is unsupported, conflates sources, or should have been an abstention. | Prompt source-only reasoning and uncertainty; use direct quotes for audit and answer-level groundedness evaluation. [INFERENCE] (F18, F19) |
| Citation validation | Citation absent, malformed, points to wrong span/revision, or the cited text does not entail the claim. | Validate location indices and source ID against stored content; perform entailment/coverage checks, then repair or retract the claim. [INFERENCE] (F11–F15, F19) |

The diagnostic invariant: **“present in corpus” is only an ingestion fact.** Evidence must be current, authorized, indexed, matched by the query, survive ranking, fit in the assembled context, influence the answer, and validate against the citation target. Log evidence IDs at each boundary to locate the first stage where the expected evidence disappears. [INFERENCE]

## Worked example(s)

**Scenario (illustrative, not a benchmark).** A support assistant answers “Does error `ZX-420` affect tenant-isolated exports after the April rollout?” A 2.4-million-token corpus has a 180-token release-note chunk that says “This patch disables asynchronous export for isolated tenants,” while the heading and product/version appear elsewhere in the source. The index preprocesses 400-token semantic chunks with contextual metadata (“April 2026 export release note for ZX-420”), creates both Voyage document embeddings and a BM25 index, filters by tenant entitlement and effective date, retrieves 80 candidates, reranks to 8, and sends source text plus IDs as custom citation blocks. That query intentionally mixes exact-code lookup, semantic question, and date/tenant constraints. The implementation should measure recall@80 and precision@8 against labeled evidence; it should never claim success just because the note is present in the source repository. [INFERENCE] Choices reflect contextual retrieval, hybrid search, reranking, and citation behavior (F2–F6, F13, F20–F21, F27).

**Pseudocode (Python-like; not runnable, provider-neutral retrieval plus Anthropic Messages API shape):**

```python
q = "Does ZX-420 affect tenant-isolated exports after the April rollout?"
principal = auth.current_principal()
filters = {"tenant": principal.tenant, "effective_at": "2026-04-30", "status": "published"}

# Each branch applies the same authorization/lifecycle filters.
lexical = bm25.search(q, filters=filters, k=80)
query_vec = voyage.embed([q], model=EMBED_MODEL, input_type="query").embeddings[0]
semantic = vector_index.search(query_vec, filters=filters, k=80)
candidates = rank_fuse_and_dedupe(lexical, semantic)
ranked = voyage.rerank(query=q, documents=[c.text for c in candidates],
                       model=RERANK_MODEL, top_k=8)
evidence = [candidates[item.index] for item in ranked.data]

# Build source-backed custom content. Keep contextualized index text distinct
# from the original passage used as evidence and citation content.
search_result = {
    "type": "search_result", "source": evidence[0].canonical_url,
    "title": evidence[0].title,
    "content": [{"type": "text", "text": evidence[0].original_text}],
    "citations": {"enabled": True},
}
# Send `search_result` in the custom search tool's tool_result; instruct Claude:
# answer only from supplied evidence, cite claims, and say when evidence is absent.
```

The code is pseudocode because storage, rank-fusion, auth, and retrieval SDKs are application-specific. Voyage model identifiers and response fields should be checked against current provider docs. For strict structured output, use citation-compatible text blocks and parse/validate them in application code; do not combine citations with strict `output_config.format`. (F14, F20–F23)

## Diagram spec

**Type:** flow. **Nodes/edges:** ingest documents → parse and preserve source metadata → chunk → contextualize → dense embedding index + BM25 index; request + principal → normalize/expand query → ACL/metadata filter → parallel dense and BM25 retrieval → rank fusion/deduplication → reranker → evidence/context budgeter → Claude Messages API (`search_result`/document citations) → answer with cited claims or uncertainty → citation and entailment validation → response. Instrument evidence IDs at retrieve, rerank, context, answer, and citation validation. **Caption:** Retrieval quality is a chain: log and evaluate the evidence boundary at every transition.

## Exam lens

- [EDITORIAL INFERENCE] If the source set is small and stable, direct context can be simplest; if it is large and frequently queried, indexed retrieval is scalable; if evidence requires iterative navigation or is highly dynamic, favor tools for just-in-time exploration; combine them when common questions need fast retrieval and edge cases need exploration.
- [EDITORIAL INFERENCE] For exact identifiers plus paraphrase queries, choose hybrid dense + BM25 and fuse candidates; rerank only after broad recall, and choose the cutoff using evidence recall, latency, and cost measurements.
- [EDITORIAL INFERENCE] When a claim is wrong, first establish whether relevant evidence was authorized and reached the prompt. Do not “fix the prompt” for evidence missing at query, filter, retrieval, or reranking stages.
- [EDITORIAL INFERENCE] A citation pointer proves where the cited text came from, not that the text entails every claim; validate citation coverage and allow abstention where the evidence is missing or conflicting.

## Common mistakes

- Equating “document is in the corpus” with “Claude received relevant evidence.”
- Using only vector search when queries contain exact codes, names, or version strings.
- Treating Anthropic's benchmark percentages as guaranteed improvements on a different corpus.
- Increasing top-k without checking distraction, duplication, and context budget.
- Reranking before applying authorization filters, or treating similarity/relevance scores as calibrated confidence.
- Citing the contextual prefix as factual evidence when the original source passage is what supports the claim.
- Treating a valid citation location as proof of entailment, source freshness, or authorization.
- Expecting citations from web fetch without explicitly enabling them, or mixing citation-enabled and citation-disabled document blocks.

## Self-check

1. **A relevant release note exists but is absent from the top 80 results. Is the generation prompt the first thing to change?** No. First inspect query, filters, index freshness, chunking, and candidate recall; the model cannot cite evidence it never received.
2. **Why combine BM25 and dense retrieval for `E_CONN_RESET_47`?** BM25 can match the exact identifier; dense retrieval can capture a paraphrase of the symptom. Fuse candidates, then rerank.
3. **What does a `content_block_location` citation tell you, and what does it not tell you?** It points to the zero-based content block range supplied as a source; it does not itself prove the passage entails the claim or represents the latest authorized revision. (F12–F15)

## Unresolved

- Anthropic's reported retrieval improvements are an experiment over its selected datasets/configurations; no universal effect size or default chunk size follows from them. Local evaluation is required.
- Anthropic's current citation documentation includes API/model examples whose names evolve; the block shape and location semantics are the stable points captured here. Confirm model availability and platform parity at implementation time.
- The official material does not prescribe a universal confidence score, ACL filtering algorithm, metadata schema, or stage-level diagnostic metric set. These are explicitly treated as engineering inferences above.
- The Voyage embedding and reranker docs are live, version-sensitive provider references; verify model lifecycle and limits at build time.
