# Fact-check: Reference Building Blocks
Checked: 2026-11-19 · Reviewer: GPT-6 (Codex)
## Summary
39 citation claim groups checked: 35 supported as written, 4 corrected or narrowed, 0 unsupported claims remain; 4 citations added; 1 uncited provider detail removed; 1 shell code block checked (no Python block to parse). Uncited factual and API-specific statements were reviewed and either cited, narrowed, or retained as explicit recommendations/editorial inference.
## Changes
- Execution-owner table — the tool runner and Managed Agents are marked Beta in current docs → added version status and citations (F3, F36).
- Managed Agents row — the harness description now matches the current overview and cites its stated use case → aligned wording (F39).
- MCP integration — local stdio process behavior now has a direct source; access language is scoped to the process’s OS permissions and configured credentials (F37).
- Permission table — the citation now supports all three outcomes (allow, ask, deny), not only deny (F19).
- Hook controls — replaced a table-only excerpt that failed quote verification with the current docs’ exact explanation of exit code 2 and `PreToolUse` (F20).
- Provider table — removed the unsupported Bedrock credentials detail; kept the documented AWS-operated inference and release schedule (F25, F26).
- Google Cloud provider row — separated the SDK’s `AnthropicVertex` support from Google’s operator role and cited each source statement (F30, F38).
- `CLAUDE.md` and skills — changed “Put standing conventions in memory” to “Put standing conventions in `CLAUDE.md`” to avoid confusing instruction files with auto memory (F18).
- Enforcement section — clarified that some controls guide behavior while others block calls or restrict processes; sandbox wording now names the Bash process (F23).
- Exam lens — retained as an `ExamLens` editorial decision-pattern summary; checked against the guide’s sample-item rationales on retry conditions, deterministic external controls, and approvals.
- Code and build — checked the current `claude -p` and `--output-format json` syntax; the chapter has one shell example and no Python code block. Citation check printed `OK`; quote verification reported 39 citations with 0 not-found; requested Astro build completed.
## Remaining concerns
- The official exam guide does not list “Building Blocks” as a standalone tested skill. Coverage was checked against its named product list and the chapter’s cross-cutting runtime-control content; this appendix should not be presented as a separate objective.
- Managed Agents, tool-runner status, provider feature matrices, and model identifiers are version-sensitive; re-check provider documentation before implementation.
