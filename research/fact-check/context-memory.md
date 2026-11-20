# Fact-check: 1.4 Context and Memory Architecture
Checked: 2026-11-19 · Reviewer: GPT-6
## Summary
Checked 99 original citation markers and 1 code block, plus uncited claims and all five objective areas. The 35 original citation quotes were verified; 10 citations were added. The rewrite retained supported claims, fixed partial claims, and removed unsupported or unnecessary details, but a reliable numerical breakdown of the 99 markers into supported, fixed, and removed was not recorded. The original Python block was removed; the replacement example is prose, so no Python blocks remain to parse.
## Changes
- Context and cache — separated window occupancy from billing; removed unsupported numeric cache prices and minimums (F2, F4, F24).
- Overflow and measurement — narrowed version-specific behavior to cited documentation and removed unsupported endpoint parameters and task-budget syntax (F5, F6, F9, F10).
- Context editing — distinguished the client's retained transcript from the edited prompt; replaced unsupported strategy defaults with documented behavior and cache trade-offs (F11–F13, F36).
- Compaction — added signed-block handling, pending tool-call and clean-cut conditions, summary validation, and instruction lifecycle; removed extensive error, SDK, and platform claims attached to an insufficient quote (F16–F19, F37–F39).
- Claude Code — retained the cited default threshold and scoped-rule distinction; removed unsupported flags and overbroad reload claims (F32, F33).
- Memory — clarified that the application must execute writes, serve the store, retrieve state, and validate paths; removed the claim that a file automatically carries invariants across a cut (F20, F21, F40, F41).
- Mid-conversation changes — qualified system-message and tool-change behavior by model support, added placement evidence, and retained the untrusted-text boundary (F25–F27, F42).
- Tool catalog — added the requirement to send full deferred definitions and the breakpoint restriction; replaced unrelated programmatic-calling citations with a direct source (F29, F43–F45).
- Worked example — replaced unexecuted Python that skipped tool execution, assumed successful memory writes, and cut history by message count with an illustrative operational sequence (F21, F25, F29).
- Decision table, callouts, exam lens, and self-checks — removed unsupported absolutes and repeated claims; framed the exam lens explicitly as editorial decision patterns. Checked against the three sample-item rationales in the guide.
## Remaining concerns
- The original 99 cited passages were not tallied by individual disposition, so exact supported/fixed/removed counts cannot be reconstructed reliably after the rewrite.
- Model support, beta interfaces, and pricing can change; check the linked platform documentation for the deployment in question.
