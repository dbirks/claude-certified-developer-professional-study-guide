# Fact-check: 3.1 Telemetry and Instrumentation
Checked: 2026-11-19 · Reviewer: Gemini 4 Hydrogen

## Summary
- Claims checked: 45 cited claims + 18 uncited factual/API/numeric claims
- Supported: 31
- Fixed: 16 (scope/precision refinements, citation reassignments, and 1 draft-leakage rewrite)
- Removed: 0 (replaced 1 packet meta-reference with direct prose)
- Citations added: 34 (`F36`–`F69`)
- Code blocks checked: 1 Python block (`ast.parse` passed; all SDK/API identifiers verified)

## Changes
- Intro ZDR wording — uncited and phrased as "forbids Anthropic from storing" → aligned to official wording ("under Zero Data Retention (ZDR), Anthropic does not store customer prompts or responses at rest after returning the API response") with `F36` (`F36`).
- How it works (`log record`) — missing bold on first use → bolded `**log record**` and tightened `OTel` phrasing.
- GenAI semantic conventions stability, retries, and `anthropic.*` pairing — `F2` quote did not cover Development status, automatic retries, or `anthropic.*` attributes → added verbatim citations `F37`, `F38`, and `F39` (`F2`, `F37`, `F38`, `F39`).
- GenAI attribute table (`gen_ai.operation.name`, `gen_ai.usage.output_tokens`, `gen_ai.usage.cache_*`) — `F2` and `F3` (which defines `input_tokens`, not `output_tokens`) did not support those rows → added `F40`, `F41`, and `F42` (`F7`, `F40`, `F41`, `F42`).
- Request ID (`_request_id` and `x-amzn-requestid`) — `F27` quote stopped at `request-id`/`request_id` → added `F43` and `F44` (`F27`, `F43`, `F44`).
- MCP connector span parenting — "Messages API or the MCP connector" was imprecise → clarified as "the Messages API's MCP connector or the Managed Agents MCP connector" (`F10`).
- Outbound proxy propagation — uncited vague reference to "Claude Code's outbound propagation flag" → named `CLAUDE_CODE_PROPAGATE_TRACEPARENT=1` behind `ANTHROPIC_BASE_URL` and cited `F45` (`F45`).
- Claude Code fleet metrics row — cited `F13` (tracing setup) instead of metric definitions → added and cited `F46` (`F46`).
- Analytics API query parameters and watermark — `F29` covered refresh/finalization only, not `time_bucket_width`, `group_by[]`, or `data_refreshed_at` → added `F47`, `F48`, and `F49` (`F29`, `F47`, `F48`, `F49`).
- Cache-performance diagnostics and table — `F26` did not support `diagnostics: null` (and omitted the prior-ID condition), `{"cache_miss_reason": null}`, or `previous_message_not_found`, and `previous_message_not_found` wrongly cited `F27` (`errors.md`) → fixed explanations and added `F50`, `F51`, `F52`, and `F69` (`F27`, `F50`, `F51`, `F52`, `F69`).
- Worked example intro — draft leakage ("The packet's worked example shows...") → rewrote cleanly as a direct two-turn regression example with Turn 2 `input_tokens=145` made explicit.
- Structured log events and export diagnostics — `F13`/`F14` did not cover `OTEL_LOGS_EXPORTER`, the event table names, `OTEL_*_EXPORT_INTERVAL` defaults, or `CLAUDE_CODE_OTEL_DIAG_STDERR=1` (`stderr` callback in Python / `stderr` option in TypeScript) → added `F53`, `F54`, `F55`, `F56`, `F66`, `F67`, and `F68` (`F13`, `F14`, `F21`, `F53`–`F56`, `F66`–`F68`).
- Grounding and reasoning traceability — `F31` only covered `output_config.format` 400 error, and `F32` did not cover `display: "omitted"` empty `thinking` text or `400` rejection on rearranged/modified/partially dropped `thinking`/`redacted_thinking` blocks → added `F57`, `F58`, `F59`, and `F60` (`F31`, `F32`, `F57`–`F60`).
- Content capture settings table — `ANTHROPIC_OPEN_TELEMETRY*` env vars and `OTEL_LOG_RAW_API_BODIES=1` lacked direct verbatim quotes → added `F61`, `F62`, `F63`, and `F64` (`F4`, `F5`, `F17`, `F61`–`F64`).
- Managed Agents ZDR eligibility — listed "Managed Agents" unqualified in prose and `ExamLens`, omitting the self-hosted exception → qualified as `Managed Agents (except self-hosted)` / `cloud-hosted Managed Agents` and added `F65` (`F34`, `F65`).

## Remaining concerns
- None; all 69 citations verify against current primary docs and the build passes cleanly.
