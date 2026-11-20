# Fact-check: 4.1 Complex Failure Diagnosis
Checked: 2026-11-19 · Reviewer: GPT-6
## Summary
82 cited claim placements checked against 38 citation entries: 74 supported, 8 fixed or clarified; 1 unsupported absolute statement removed. Citations added: 8. Code blocks checked: 1 illustrative text pseudocode block (not executable code).
## Changes
- Evidence-chain introduction and stop-reason table — made the first definition explicit; aligned status meanings with the current Messages API guide and clarified that an incomplete tool-use block needs a higher `max_tokens` retry (F31, F32).
- Multi-turn and multi-agent handling — clarified `pause_turn` continuation and tool preservation; limited the 400 diagnosis to documented missing or misplaced results; retained the documented parallel-result pattern (F2, F3, F33).
- Model behavior — narrowed the pinned-model claim to unchanged weights; qualified same-model refusal retry guidance; distinguished classifier stops, validation errors, and model-written refusals (F10, F34, F35).
- Instrumentation and Claude Code — split Python logging from OpenTelemetry evidence, marked the SDK tool runner beta, and cited `/mcp` separately (F18, F19, F37, F38).
- Export guidance — removed the unsupported claim that no structured local transcript schema exists and reframed export as review evidence.
- Exam lens — marked each item as editorial inference and kept them as decision patterns, not exam questions (F33, F35).
## Remaining concerns
- API-version and Claude Code command details can change; they are checked against official documentation as of 2026-11-19.
