# Fact-check: 3.3 Trace Analysis at Scale
Checked: 2026-11-19 · Reviewer: OpenAI Codex (GPT-6)

## Summary
29 original source-claim groups checked: 20 supported, 9 partially supported and fixed, 0 groups removed. Added 12 citations (F30–F41). Checked 0 code blocks; the chapter contains no fenced code or Python. Counts group repeated uses of each original citation as one source-claim group; additional uncited claims and editorial inferences were reviewed separately.

## Changes
- F1–F5, F7, F9, F11–F15, F20–F26 and F29 — supported in their documented scope; qualified the 10% head-sampling example to require independent uniform sampling and treated full-population counts as complete only when instrumentation and delivery are complete.
- Collector policy configuration (F6) — the original quote covered status only → split the claim and added exact evidence for required policies and trace latency (F30, F31).
- Collector capacity (F8) — loss was presented as inevitable and silent → explain possible early drops and the configurable blocking alternative; cite the monitoring metrics (F32, F33, F40, F41).
- Metric overflow (F10) — a shrinking filtered view was presented as proof of overflow → describe overflow as one possible cause and verify it.
- Tool span boundaries (F16) — the execution-duration quote did not establish the parent span's permission wait → add the parent span's documented boundary (F36).
- Agent SDK telemetry (F17) — the source did not establish that its OTel export is beta → remove that beta claim while retaining the sourced runtime and export statement.
- Tool span identifiers (F18) — the custom-tool quote did not establish general tool attributes → cite the tool name, call ID and error separately (F34, F39, F20).
- Session identifiers and MCP server names (F19) — the session-grouping quote did not establish the named fields or their availability → add span-reference citations and qualify availability (F35, F38).
- Claude Code event attributes (F27, F28) — each quote supported only one field in a longer list → narrow both rows to what their quotes establish.
- Clio rename — the quote for clustering did not support the name change → add the source's update (F37).
- Failure-cohort analysis — comparing groups was described as quantifying a cause → describe systemic patterns and reserve causal claims for controlled evidence. Track incomplete attempts when rebuilding denominators.
- Sampled estimate self-check — further data loss was said to always bias the estimate → state that unaccounted drops can bias it (F8, F9).
- Exam lens and synthetic example — retained as editorial decision patterns and illustrative data; checked against the guide's three official sample rationales. Sampling, aggregation and systemic failure-cohort analysis all have explanatory coverage.

## Remaining concerns
- Collector main-branch configuration, metric names, telemetry schemas and beta status are version-sensitive; verify against the deployed distribution and runtime. The cited late-span histogram covers the documented late-span scenario and is not a complete count of every late arrival.
- Complete population totals and inverse-probability estimates depend on instrumentation, delivery, and known nonzero inclusion probabilities; a trace policy alone does not establish these conditions.
