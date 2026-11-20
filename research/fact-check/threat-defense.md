# Fact-check: 7.2 Threat Defense and Adversarial Testing for Agentic Systems
Checked: 2026-11-19 · Reviewer: GPT-6 (Codex)
## Summary
- Checked all 83 original citation occurrences against their quotes and, where needed, the full source; supported claims were retained and partial or unsupported claims were fixed or removed. The supported, fixed, and removed occurrence counts were not recorded separately; the changes below identify the substantive fixes and removals. Seven citations added; two code blocks checked, including one Python block parsed with `ast.parse`.
- Coverage checked against every part of skill 7.2 and the three sample-item rationales in the guide. Citation checker, quote verifier and scoped Astro build passed.
## Changes
- Attack surface and indirect injection — the draft implied an agent trusts every tool result → defined attack surface and described tool results as untrusted data (F2, F10).
- Screening and the defense figure — the draft grouped a model-based classifier with deterministic gates → distinguished probabilistic screening from executor-enforced rules; documented refusal handling and auto-mode warning behavior (F12, F37, F40, F42).
- URL provenance — F15 only quoted credential checks, not client-tool-result laundering → added a direct source quote and qualified the resulting fetch as subject to other checks (F14, F15, F38).
- Worked attack — called 1% a documented best case and implied every prompt defense fails → described it as Anthropic's risk warning, not a guaranteed outcome (F4, F19).
- MCP example and configuration — cited a pinning quote for enablement settings and left the email gate unwired → added a configuration source, labeled omitted wiring, and clarified that pinning does not guarantee server behavior (F8, F17, F39).
- Permission order — unsupported scope across products and uncited stages → attributed the order to Agent SDK documentation, removed `manual`, and noted that steps can resolve calls early (F27, F41).
- Memory poisoning — conflated persistent malicious content with directory traversal → explained each separately and recommended provenance and write controls (F5, F16).
- Red teaming — treated a 1% result as a measured residual rate and did not define scoring → distinguished the illustrative warning from the adaptive evaluation and added outcomes, benign cases, and replay guidance (F19, F35, F43).
- Framework mapping — represented path traversal prevention as a direct defense against poisoning training data → replaced it with data provenance and review; narrowed the AI 600-1 claim to its quoted scope (F5, F34).
- Self-check and decision criteria — claimed stripping inputs closes injection or that screening always reduces risk → described limited classifier visibility and residual errors (F19, F21, F40).
- Exam lens — framed the bullets as editorial decision patterns and removed wording that presented invented scenarios as exam items. The deterministic-control pattern remains consistent with the official sample rationale.
- Editorial pass — shortened definitions and claims, corrected rendering/exfiltration qualifications, and added punctuation before table citations.
## Remaining concerns
- The Python example is pseudocode: its client, pinned tool list, and email executor wiring are intentionally omitted. Deployments must implement and test those controls.
- The quote verifier reports six quotes as `ok-loose` after normalization; it reports no missing or failed fetches.
