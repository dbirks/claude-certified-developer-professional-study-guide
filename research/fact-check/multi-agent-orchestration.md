# Fact-check: 1.1 Multi-Agent Orchestration
Checked: 2026-11-19 · Reviewer: GPT-6
## Summary
Checked all 34 original citation records (21 supported as drafted; 13 partial or overstated and corrected); reviewed uncited factual and numeric statements. All 59 final cited claims are supported. Removed or narrowed 8 stale or unsupported assertions. Added 25 citations. Checked and Python-parsed 1 code block. Quote verification: 49 exact matches, 10 normalized matches, 0 not found.
## Changes
- Opening and orchestration patterns — limited cost and performance claims to documented guidance and Anthropic's named evaluations; added precise routing, voting, variance, and rate-limit evidence (F3, F5, F35, F36, F62).
- Delegation and SDK limits — corrected depth, concurrency, spend-cap, field-name, tool-allowlist, and fork behavior; removed unsupported `TypeError` assertion (F17–F19, F37, F49, F55, F59, F60).
- Context and parallelism — removed checkpoint/resume claim without supporting evidence, corrected the illustrative cost and latency arithmetic, and described fork context reuse and worktree isolation from current docs (F10, F38, F57).
- Communication patterns — removed outdated Agent Teams mailbox/file-lock claims; clarified interactive limits, Dynamic Workflows, and verified Managed Agents thread/run caps, credential scope, and retry/budget behavior (F30–F34, F40–F45, F50, F56, F61).
- Approval flow — clarified permission evaluation order and subagent inheritance, corrected the `acceptEdits` example, and separated deferred-call resume behavior from the initial defer response (F23–F27, F48, F51, F58).
- Reference code — labeled the example as a skeleton, made the Bash deny hook reachable, removed an obsolete model ID, and parsed the Python block.
## Remaining concerns
- No factual claims remain unresolved. The Python example intentionally omits imports and a real approval backend; the chapter labels it as a reference skeleton.
