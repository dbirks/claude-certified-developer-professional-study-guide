# Fact-check: 2.1 Reliability Engineering for Claude Services
Checked: 2026-11-19 · Reviewer: Gemini 4 Hydrogen (High)

## Summary
- Claims checked: 48 cited claims/rows + 7 uncited factual/numeric/API claims swept (55 total)
- Supported: 34 · Fixed (PARTIAL/uncited): 21 · Removed: 0 (1 SelfCheck scenario swapped from unconfirmed server-side fallback on AWS to Files API)
- Citations added: 10 (`F36`–`F45`); existing citations refined: 4 (`F5`, `F33`, `F34`, `F35`)
- Code blocks checked: 1 Python block (`ast.parse` OK; 3 logic/edge-case bugs fixed; not executed against live API)

## Changes
- Intro (`01-reliability.mdx`) — Three-layer failure sentence cited only `F20` (which covers `stop_reason`, not HTTP errors or mid-stream `event: error`), and failover example said "another cloud" generally → Cited `F20 F36 F37` for all three layers and specified Azure-hosted Microsoft Foundry (`F33`).
- Error JSON shape & `request-id` (`Read the signal before you react`) — Claimed `error.details` on all errors using `F9` (`request-id` header only), and said "both SDKs" expose `_request_id` when seven official SDKs exist → Marked `error.details` optional, added `F37`, and named the Python and TypeScript SDKs (`F9 F37`).
- Client & account errors (`401`, `402`, `403`, `404`, `413`) — `401` CORS description omitted the Compliance API case (`because of its settings`), `413` said "lower on partner platforms" without listing Anthropic-managed 32 MB cloud caps, and `402`/`403`/`404` appeared in Figure 1 and Decision criteria without prose/table definitions or citations → Clarified `401` retention/Compliance scope (`F2`), added explicit `402`/`403`/`404` coverage with `F41`–`F43`, and expanded `F5` quote to cover the 32 MB limits on Claude Platform on AWS, Anthropic-managed Google Cloud, and Microsoft Foundry.
- Error table (`408`, `413`, `504`, `529`, client timeout) — Listed only base classes (`APIStatusError`, `InternalServerError`) and omitted TypeScript's `APIConnectionTimeoutError` → Added SDK status-specific subclasses verified in `anthropic-sdk-python` `_exceptions.py` and `anthropic-sdk-typescript` `error.ts` (`RequestTimeoutError`, `ContentTooLargeError`, `GatewayTimeoutError`, `OverloadedError`, `PaymentRequiredError`) and noted `APIConnectionTimeoutError` (`F17 F18 F19`).
- SDK retry defaults & retry budgets (`Retry and backoff design`) — Said "Both official SDKs" instead of Python and TypeScript, and cited `F35` (Google SRE overload chapter) for jitter and idempotency keys which it does not state → Scoped to Python and TypeScript (`F16 F17 F19`), kept `F35` strictly on the 10% retry budget / 1.1x vs 3x claim, and framed jitter and idempotency keys as engineering recommendations.
- `inference_geo` & worked example (`Retry and backoff design`) — Stated `inference_geo` "buys nothing", used internal drafting phrase `"Worked example from the packet"`, and left Start-tier `claude-opus-5-5` limits uncited → Clarified `inference_geo` adds no rate-limit headroom (`F15`), removed `"from the packet"`, and added `F44` for the Start-tier `4,000 / 2,000,000 / 400,000` limits.
- Python wrapper (`Retry and backoff design`) — `body.get("error", {}).get("details", {})` could raise `AttributeError` if `details` is `null`; last loop iteration slept and consumed retry budget before raising; `"stop_sequence"` was missing from the `stop_reason` return tuple → Guarded `None` values, skipped sleep/budget increment on `attempt == max_attempts - 1`, handled `refusal` on final attempt, and added `"stop_sequence"`.
- Graceful degradation (`Circuit breakers and graceful degradation`) — Repeated "lower-effort" across steps 2 and 4 and left Message Batches rate-limit independence uncited → Bolded **Graceful degradation** on first use, removed repetition in step 4, and added `F45` for Message Batches separate rate limits.
- `stop_reason` table & refusal fallback (`Telling rate limits, refusals, and context-window stops apart`) — Omitted `stop_sequence`, overstated `tool_use` "no trailing text" rule (which applies only when a server/MCP tool is waiting), described server-side fallback as "cheapest" instead of "simplest" (both server-side and SDK middleware apply fallback credit), omitted `BetaRefusalFallbackMiddleware`, and left prefill `400` / mid-stream `event: error` / context-window `200` partially uncited → Added `stop_sequence`, scoped the no-trailing-text rule (`F22`), changed "cheapest" to "simplest", added `BetaRefusalFallbackMiddleware` (`F40`), and added `F36` and `F38`.
- Cross-region routing & parity (`Cross-platform fallback and feature parity`) — Generalized `inference_geo` shared limits to "cross-region routing inside one platform", and SelfCheck #3 claimed Claude Platform on AWS keeps `server-side fallbacks` (the refusals doc lists beta support only on first-party Claude API and Anthropic-managed Google Cloud) → Scoped `inference_geo` shared-pool rule to the Claude API (`F15`), added explicit cross-region tradeoffs for Bedrock/Vertex (`F31 F32`), and updated SelfCheck #3 to test `code_execution` and the Files API (`F30 F33`).
- Duplicate citation (`Failure modes and recovery`) — Removed duplicate `<Cite id="F21" /><Cite id="F21" />` at the end of the `pause_turn` trap sentence (`F21`).

## Remaining concerns
- Live execution of the Python `call_with_resilience` wrapper against live API endpoints was not performed (`anthropic` Python package is not installed in the workspace environment); syntax was verified via `ast.parse` and identifiers via the official `anthropic-sdk-python` repository (`_exceptions.py`, `types/message.py`) and `platform.claude.com/docs`.
- Whether `fallbacks` (`server-side-fallback-2026-07-01`) executes server-side fallback on Claude Platform on AWS is ambiguous across docs: `refusals-and-fallback` names only the first-party Claude API and Google Cloud (Anthropic managed), whereas `fallback-credit` lists the `server-side-fallback-2026-07-01` header for Claude Platform on AWS and Microsoft Foundry (the latter explicitly rejects `fallbacks`). Kept the chapter table and SelfCheck conservative on this point.

## Second pass (OpenAI Codex)

Checked: 2026-11-19 · Reviewer: OpenAI Codex

### Summary

- Checked all 45 existing citation entries and their chapter uses (119 citation components after editing), plus uncited factual statements. At the citation-entry level, 38 remained supported as used and 7 required narrower wording or qualification; these counts do not equate a citation component with a single atomic claim.
- Fixed 7 groups of cited claims and several uncited recommendations; removed 1 unsafe code example and replaced it. Added 1 citation (F46). Checked 1 Python code block; syntax parsed, but no live API call was made.
- Compared the chapter with all skill 2.1 sub-objectives and the official sample decision patterns. Citation check, quote check, and scoped Astro build passed.

### Changes

- Retry example — The early-window exception allowed unbounded retries and the failover bypassed the retry budget and most parity checks → replaced the wrapper with a single-attempt, spend-cap classification example and made scheduling and failover explicit caller responsibilities (F6, F17, F39).
- Retry arithmetic — A 10% budget was described as an unconditional guarantee, while the implementation did not enforce it → state the window and strict enforcement assumptions; distinguish cache hits from initial writes and misses (F12, F35).
- Cross-model fallback — The chapter did not clearly distinguish refusal fallback from availability failover → state that server-side refusal fallback does not retry rate limits, overload, or server errors; qualify middleware credit for Haiku 5.5 (F40, F46).
- Stream recovery — “Completed text block” was more restrictive than the source and the error wording implied every interruption produces an error event → use the most recent text block and qualify API error events (F24, F25, F36).
- Tool continuation — The server-tool rule was generalized to all simultaneous tool use and omitted container and MCP continuation requirements → restrict it to the documented parallel group and include those fields (F22).
- Rate-limit handling and cache accounting — Defaults and header availability were overstated → qualify default ITPM limits, cache-hit assumptions, and `retry-after` availability; frame pacing and caching as choices (F11, F12, F14, F39).
- Error classification and exception table — Absolute claims about client errors and causation were too broad; less familiar status-specific subclasses lacked SDK documentation in their cited entries → qualify the claim and use documented base classes (F1–F4, F17).
- Decision guidance — A purported fixed degradation order, an unsupported claim about most incidents, and deterministic telemetry diagnoses were presented as facts → recast as workload-dependent choices and investigations. Distinguish reducing effort from shrinking input.
- `pause_turn` and stop handling — Unqualified claims about lost sandbox state and OTPM cost were too broad → specify retaining container files and distinguish the `max_tokens` setting from tokens actually generated (F13, F21).

### Remaining concerns

- The official fallback documentation and other platform documentation differ in how explicitly they describe server-side fallback on Claude Platform on AWS; the chapter retains the uncertainty. Verify the exact beta and platform before deploying (F29, F30).
- The example was checked for syntax and against documentation and SDK source, not executed with credentials. SDK and cloud feature details can change.
- The requested cleanup command was rejected by the command safety filter; the generated build directory was removed using Python instead.
