# Fact-check: 8.3 Unattended and Event-Driven Agent Operations
Checked: 2026-11-19 · Reviewer: OpenAI GPT-6

## Summary
Checked 100 original citation occurrences against 35 citation entries and their source pages as needed. At the source-entry level, 29 supported the associated text directly or with surrounding documentation; 6 needed correction or expanded context. Fixed 6 claim groups and removed 2 unsupported generalizations. Added 5 citations. Checked 1 YAML code block; there are no Python code blocks to parse. The objective's goal, schedule, event response, checkpoint, notification, and escalation elements are covered. The ExamLens states editorial decision patterns and preserves the sample rationales concerning stop conditions, judge calibration, and external deterministic controls.

## Changes
- Tool permissions — `--allowedTools` was incorrectly described as an exclusive tool allowlist → distinguish preapproval from `--tools` availability and other permissions (F25, F36).
- Workflow example — cited a cloud-task default branch for GitHub Actions and omitted `workflow_run` trust and default-branch conditions → cite GitHub, restrict the example to same-repository revisions, require trusted revisions, and disable persisted checkout credentials (F8, F37, F40). Same-repository membership alone does not establish trust.
- File recovery — omitted the option needed to expose checkpoint UUIDs and skipped-path behavior → add replay configuration and result inspection; clarify Bash and subagent exceptions (F11, F12, F38, F39).
- Bare mode — quote only said not to use it for hooks → replace with the specific documented behavior (F9).
- Goal comparison — implied the invocation retained conversation history only → distinguish session history from filesystem state (F10, F16).
- Hooks and denials — removed the claim that hooks are the only way to notify and unsupported claims about hook delivery; qualified the continued-run behavior with the relevant flag (F7, F26, F35).
- Editorial and scope — defined trigger, bounds, evidence, and checkpoint manifest; tightened prose, removed an unsupported frequency claim about incidents, and labeled exam patterns as decisions (F15, F17, F23).

## Remaining concerns
- Quote verification returned 37 matches (including one loose match), zero not-found results, and three fetch failures: F37, F38, and F40. Their source pages and exact text were checked using web fetch, but the script could not fetch those URLs; rerun it with working direct HTTP access before publication.
- The workflow was checked against documentation but not executed with a GitHub App, API key, and a real upstream run. It requires a trusted revision, and a production responder still needs evidence retrieval, monitoring, and alerting.
