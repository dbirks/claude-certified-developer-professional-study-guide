# Fact-check: 7.1 Runtime Guardrail Systems
Checked: 2026-11-19 · Reviewer: GPT-6
## Summary
53 citation entries reviewed (35 existing, 18 added): 12 supported as drafted, 23 corrected or qualified, and 0 cited entries removed. Four unsupported or overstated details were removed from the prose. Code blocks checked: 2; Python AST parse passed.
## Changes
- Hook behavior and examples — exit-code handling had overbroad failure semantics and callback failures lacked scope/version limits → clarified exit 0/1/2 behavior and `onFailure: "block"` requirements (F1, F7, F42, F47).
- Permission pipeline — critical-path and settings precedence claims were stale or missing list-merge support → aligned wording and refreshed critical-path quote; added list-merge evidence (F8–F14, F43).
- Filtering and PII — distinguished prompt screening, tool-output screening, context/display masking, and error-report redaction → added tool-output coverage and scoped each redaction point (F4–F6, F24–F27, F35, F55).
- Sandboxing — the draft implied a broader built-in boundary and overstated credential isolation → clarified shell versus web/MCP scope, strict allowlist behavior, and external proxy use (F18–F23, F37–F38, F49).
- Refusal handling — the draft overstated server-side fallback availability and lacked support for HTTP 200, batch handling, and fallback beta details → separated Claude API/Google Cloud routing, Haiku 5.5, and Message Batch behavior (F28–F30, F36, F39–F41, F45, F48, F52).
- False-positive tuning — removed the unsupported claim that Stage 2 reviews exactly 850 calls and corrected the arithmetic to false-positive counts; clarified classifier context sources (F31–F34, F50–F51).
- Coverage and editorial — added an explicit production-access boundary, removed unsupported specificity and filler, and kept the ExamLens as decision patterns rather than exam questions.
## Remaining concerns
- No material claims remain unverified. Version-sensitive SDK, Claude Code, model, and fallback details reflect official documentation checked on 2026-11-19.
