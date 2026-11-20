# Fact-check: 8.1 Parallel Agent Orchestration for Engineering Work
Checked: 2026-11-19 · Reviewer: Claude (Opus 5.5 subagent)
## Summary
About 95 cited claims checked against current code.claude.com docs (agents, worktrees, agent-view, agent-teams, workflows, monitoring-usage, analytics, costs, best-practices, commands, hooks, cli-reference, permission-modes) and the Anthropic C compiler article. 64 supported as written, 29 fixed (reworded or re-cited), 2 removed. The chapter cited 14 ids (F31–F44) that did not exist in the yaml, so `check-citations` failed. I recreated them with verbatim quotes and added 34 more (F45–F78), for 48 new entries in total. Checked 1 bash code block (`bash -n` passes; no Python). `check-citations`: OK. `verify-quotes`: 78/78 ok. Build: complete.
## Changes
- Citations yaml — F31–F44 were cited but missing (check-citations failed) → created entries with verbatim quotes from the current pages (F31–F44).
- Execution-model table — agent view's research-preview status and agent teams' experimental status were missing; the Projects row was vague; the workflow concurrency limit cited F17, whose quote covers only the 4,096-item limit → added status, specific sources and limit citations (F56, F15, F62, F46, F61, F77, F78).
- Worktree section — the background-isolation sentence was repeated → removed. The PR-reference row now names the PR number, GitHub PR URL, and GitLab MR URL forms (F4). `.worktreeinclude` now says "untracked" files (F5).
- Task decomposition — "In a separate harness" was wrong: the `current_tasks/` lock files belonged to the same harness → corrected (F20). The oracle and delta-debugging details are now cited to the exact passages (F52, F64), and the scale figures likewise (F53).
- Decomposition rule 3 — cited F14 (team size) for a same-file and sequential-work claim → re-cited to agent-teams guidance (F48).
- Harness advice — "run regression tests" and "precompute summaries" lacked support → now the ERROR-line rule (F51) and the CI pipeline (F50).
- Merge strategy — sub-objective coverage was thin → added conflict-handling recommendations (labeled engineering practice) and the documented fact that background sessions never merge, force-push, or push to main (F63).
- Bash script — bug: `--permission-mode acceptEdits` does not approve `pnpm test` or `git commit`, so a `-p` worker could not run tests or commit → added `--allowedTools` (placed after the prompt so the variadic flag cannot swallow it), added an OTLP endpoint, and cited the flags (F33, F54, F55).
- Hooks — the exit-code-2 claims for TaskCompleted, TaskCreated, and TeammateIdle cited only F16 (a description of TaskCompleted) → added F58, F59, F60. The read-only reviewer now cites F49.
- Telemetry — the commit-join claim cited F28 (a refusal quote) → re-cited to F65. The retry details now cite F66–F68. The PR counter cited F24 and said "Claude Code commands" → now "shell command or MCP tool" (F45). Added that in-process teammate events lack `agent_id` (F37). Tracing claims now cite F69 and F70.
- Analytics — added that contribution metrics are a public beta (F57). The Console dashboard is now described as "usage and spend metrics only" (F30).
- Failure table — the Stalled-team detection relied on per-agent API activity, which is wrong for in-process teammates (no `agent_id`) → rewritten (F37, F72). Prompt-cache waste: "stagger" was re-described as the documented prefix hold (F47) and teammate shutdown is now cited (F71). Removed the unsupported recovery advice to "narrow prompt and tool scope" for refusals.
- Agent-teams limits — "two traps" listed four items, and the claims cited the generic F15 → rewritten and cited per item (F73–F75, F13).
- Repo-settings callout — the advice on where to set exporter variables was uncited → now F76.
- Exam lens — the third bullet cited F17 (irrelevant) → re-cited (F66, F25, F28, F65). "Flag is ignored in -p" is now "-p does not spawn teammates" (F13). The bullets remain framed as decision patterns.
- yaml claims for F10, F16, F17 narrowed to match their quotes.
## Remaining concerns
- Version-sensitive: agent view (research preview), agent teams (experimental), workflow limits (16/256/4,096/1,000), enhanced tracing (beta), `OTEL_RESOURCE_INCLUDE_HOST` (v2.1.326+), and contribution metrics (public beta).
- The herd-collision detection signal (lines-of-code counts rising without commits) and the cache-waste signals are editorial inference, labeled as such.
- The F65 URL anchor `#metrics` may not match a page heading exactly; the quote verifies against the page.
