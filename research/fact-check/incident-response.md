# Fact-check: 4.2 Incident Response and Learning Loops
Checked: 2026-11-19 · Reviewer: OpenAI GPT-6
## Summary
Checked 38 original citation entries and their cited passages, plus uncited claims and three code blocks. The revised chapter contains 98 citation placements; 42 source entries passed quote verification. More than 20 claim passages were corrected or narrowed, and the unsafe runnable Python block was removed; four citations were added. Counts of individually supported versus corrected original sentences were not recorded separately.
## Changes
- Triage — an operational status page and absence of 529 did not establish a local cause → compare vendor and internal evidence without asserting causation (F6, F12).
- Incident roles — the communications lead's maintenance of the record is optional, and a blanket ban on debugging exceeded the source → narrow role descriptions (F1, F3, F4).
- Routing and model IDs — generalized historical sticky routing and uncited pre-4.6 alias detail → describe the incident and specify Claude API aliases (F8, F14, F15, F39).
- Managed Agents containment — interrupt does not end workflow runs, and running calls may complete → handle pending calls, stop or await runs, and archive only when idle (F20, F40, F41).
- Credential containment — disabling an Anthropic key does not revoke a separate MCP credential → name both issuers; replace the erroneous Python example with explicitly labeled pseudocode (F18, F19).
- Permission policy — a policy uses an object with a type field, and archived sessions should not be updated for resumption → correct syntax and sequence (F21, F22, F42).
- Fleet controls — hourly refresh does not guarantee a hard propagation deadline; in-process servers require application-side controls → qualify the timing and scope (F24, F25).
- Fallback and remediation — remove an unsupported cache-cost claim and continuous-evaluation attribution; state the documented rollback and deployment tests (F9, F27).
- Worked example — a finance alert is not manual discovery, and an MCP toolset defaults to approval → describe a monitoring gap and explicitly set an allow policy in the scenario (F22, F31).
- Learning loop — replace claims that overspecify postmortem review, retry alerts, and evaluation outcomes with source-aligned statements and recommendations (F10, F33, F34, F37, F38).
- Code and scope — checked the managed-settings JSON against the settings reference; labeled the response and eval examples pseudocode. The removed Python block is no longer presented as runnable.
- Exam lens — framed as editorial decision patterns; retained stop-reason branching and deterministic controls without inventing exam items.
## Remaining concerns
- Citation-placement totals are not a count of distinct original claims; supported, fixed, and removed sentence counts were not tracked individually.
- Beta APIs and Claude Code settings can change; check current documentation before deployment. The worked example and eval schema are illustrative.
