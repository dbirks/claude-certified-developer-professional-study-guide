# Fact-check: 2.2 Scale and Throughput Management
Checked: 2026-11-19 · Reviewer: Gemini 4 Hydrogen

## Summary
- **Claims checked:** 53 (45 originally cited claims + 8 uncited factual/API-specific claims swept)
- **Supported:** 40
- **Fixed / reworded / newly cited:** 13 (5 partial or misattributed cited claims fixed; 8 uncited factual/API claims verified and cited)
- **Removed:** 0
- **Citations added:** 20 (`F36`–`F55`; `F33` extended by one adjacent verbatim sentence)
- **Code blocks checked:** 0 fenced code blocks; all inline API identifiers, HTTP headers, parameters, and error codes verified against primary Anthropic documentation

## Changes
- **Intro** — "Batches, workspaces, and model buckets add ceilings that are mostly shared rather than reserved" overstated/conflated model buckets with shared pools → Clarified that workspaces, shared model-family buckets, and Message Batches add separate ceilings subject to shared pools (`F11`, `F15`, `F19`).
- **How Claude meters throughput** — Table mixed a timing row (`ITPM timing`) into the `Dimension` column, and omitted `cache_read_input_tokens` identifier → Moved ITPM timing into prose below the table and named `cache_read_input_tokens` explicitly (`F5`, `F6`, `F7`).
- **How Claude meters throughput** — "Prompt caching is a throughput technique before it is a cost technique" was editorial hyperbole → Reworded to state that prompt caching raises effective input throughput as well as cutting cost (`F5`).
- **Read limits from the response headers** — Four header families, RFC 3339 reset format, and nearest-thousand rounding were uncited → Added verbatim quotes and cited (`F36`–`F39`).
- **Rate-limit strategy § Tiers, model buckets, and version drift** — Called Start/Build/Scale "service tier" (contradicting the paragraph below) and omitted Evaluation/Custom tiers; placed `<Cite>` directly on numeric table cells (`400,000`) → Changed to **usage tier**, added Evaluation/Custom tier progression (`F47`), and moved `<Cite id="F8 F9 F10" />` to prose immediately after punctuation.
- **Rate-limit strategy § Bursts and ramp limits** — Cited `F14` for "Message Batches are not subject to ramp limits" (not in `F14` quote), and left separate input/output metering, cache-read exclusion, and model-dependent step/starting amount uncited → Added `F40`, `F41`, `F42`, `F52` and cited cleanly (`F2`, `F3`, `F40`–`F42`, `F52`).
- **Rate-limit strategy § Spend caps and other 429s** — Omitted `enforced_spend_limit_reached` error code and cited `F23` alone for the Claude Code workspace exception → Added `enforced_spend_limit_reached` (`F43`) and Claude Code workspace 429 exception (`F44`).
- **Queueing and backpressure** — "admission controller" and "head-of-line blocking" lacked crisp definition/bolding → Defined **admission controller** inline, bolded **head-of-line blocking** on first use, and tightened to active voice.
- **Multi-tenant quota and isolation** — Unscoped keys selecting a workspace via `anthropic-workspace-id` were omitted → Added `anthropic-workspace-id` selection rule (`F48`) and moved table cell citations into prose after punctuation.
- **Batch pipeline design** — `POST /v1/messages/batches`, `requests`/`params`, unique `custom_id`, `max_tokens >= 1`, JSONL streaming, four `result.type` values, non-billing of errored/expired items, and "most batches finish within 1 hour" were either uncited or misattributed to `F33`/`F27` → Extended `F33` with adjacent uniqueness sentence, added `F45`, `F46`, `F49`–`F51`, `F53`–`F55`, and moved table cell citations (`F16`–`F18`) to prose.
- **Decision criteria** — Ramp item lacked `F12`/`F13`, and per-item batch outcome evidence cited `F27` instead of result-type documentation → Updated to `F12 F13 F14` and `F54`.
- **Failure modes and recovery** — "so reads are free and writes are not" risked conflating zero ITPM consumption with zero billing cost; spend-cap callout lacked `F43`/`F44` → Reworded to "so cache reads do not consume ITPM while cache writes do" (`F5`) and added `F43`, `F44`, `F49`.
- **Exam lens & Self-check** — Updated citations (`F43` on spend-cap 429; `F55` on expired batch handling).

## Remaining concerns
- None. All 55 citations in `research/citations/scale-throughput.yaml` passed `scripts/verify-quotes.mjs` (`ok 36 · ok-loose 19 · not-found 0`), `scripts/check-citations.mjs` printed `OK`, and `pnpm astro build` completed with 27 pages built. Per-tier limits (`F8`–`F10`, `F16`–`F18`) and ramp step parameters (`F41`) remain version-sensitive and subject to change.
