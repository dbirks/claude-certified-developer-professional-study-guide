# Fact-check: Reference Practice Domain 4
Checked: 2026-11-19 · Reviewer: GPT-6 Codex

## Summary
8 item-level claim clusters checked; 0 retained wholly unchanged, 8 fixed, 0 items removed; 3 citations added; 0 code blocks checked (none present). The revised answers contain 22 cited statements. Counts group related claims by original item; they are not counts of individual factual propositions.

## Changes
- Q1 — The original described the loss of parallel calls as a certain consequence and attributed an unconditional 400 to several errors → retained the documented transcript requirements without asserting that those changes caused every later behavior (F2, F3, F5).
- Q2 — The original treated fallback as guaranteed to avoid another refusal and asserted a broad reset requirement without describing its scope → removed that guarantee, distinguished buffering as a design decision, and retained the documented reset and version-specific sampling restriction (F7–F11).
- Q3 — Citations cannot by themselves distinguish stale data from generation failure, and the tool-runner logging source described the Python SDK specifically → separated retrieval, generation, and permission evidence; removed the unrelated logging and timeout assertions (F12, F13, F18).
- Q4 — The original combined unrelated startup diagnostics with a compaction failure and treated the summary as proof of root cause → used the summary and thread timeline as evidence, with an explicit limit on the inference (F14, F19).
- Q5 — The original inferred sticky routing and vendor involvement from symptoms and cited a changing status-page string → framed both as hypotheses; added coordinated rollback and stakeholder communication (F25, F28, F54).
- Q6 — The original implied idle alone established that all work had stopped, combined two independent containment incidents, and did not establish all preconditions → specified no open workflow run, included the open-run caveat, and retained reversible key disabling and documented archive sequence (F34, F36, F55).
- Q7 — The original described parameter-level blocking and managed policy precedence too broadly, conflated built-in and MCP tool configuration, and contained giveaway distractors → scoped the question to built-in tool selection and MCP approval, with explicit confirmation behavior (F37, F38, F56).
- Q8 — The original implied balanced tests prevent future failure and treated every rollback as requiring a postmortem → described triggers as examples and regression testing as protection without a guarantee; added monitoring ownership and a response threshold (F45, F46, F49–F51).
- All items — Independently checked the answer choices and rewrote the scenarios and distractors to have one best answer, except Q2 which has exactly two. The scenarios are original and do not repeat the official sample items. Skill 4.1 covers multi-turn, multi-agent, variable output, refusal, retrieval, model, harness, tools, and data; 4.2 covers triage, mitigation, rollback, communication, evaluations, monitoring, and postmortems. No ExamLens or executable code block is present.

## Remaining concerns
- Documentation and Managed Agents beta behavior can change after the review date. The questions describe hypothetical incidents, so their causal diagnoses remain conditional on the stated evidence.
