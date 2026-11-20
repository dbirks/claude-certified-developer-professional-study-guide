# Fact-check: 6.2 Latency Engineering
Checked: 2026-11-19 · Reviewer: GPT-6 Codex

## Summary
Checked 62 citation-bearing passages in the edited chapter; all 62 are supported in their final context. Fixed 11 substantive passages and removed 2 unsupported absolute claims, included in those fixes. Added 9 citations. Checked 0 fenced code blocks; the chapter contains none. The numeric example is illustrative arithmetic, and the diagram is MDX component data.

The uncited-claim sweep treated measurement advice, concurrency choices, deadlines, and evaluation criteria as engineering recommendations. The objective's latency targets, TTFT versus completion, streaming, parallel tools, cache checkpointing, and effort tuning are covered. The exam lens states editorial decision patterns and does not conflict with the three sample-item rationales.

## Changes
- Metrics and deadlines — an SRE quote did not establish all original queue and deadline claims → define metrics and frame instrumentation and propagation as recommendations (F1, F22, F23).
- Critical path — an unconditional sum omitted overlap and scheduling assumptions → define the path and qualify the arithmetic example.
- Stream events — the original citation only established forward compatibility → cite ping and error events separately and distinguish events from visible content (F8, F28, F35, F36).
- Forced tool choice — the original quote only covered `auto` → cite the documented `any` and `tool` behavior and model limitation (F11, F29).
- Cache breakpoint — a changing suffix does not rule out a hit at an earlier written prefix → explain lookback and remove the absolute miss claim in both locations (F12, F30).
- Cache ordering — the original list could imply the wrong prefix order → state tools, system, then messages (F31).
- Effort — the Opus 5.5 statement was generalized to all adaptive-thinking models → restrict it to Opus 5.5 and describe the quality, latency, and cost trade-off (F15, F16, F32).
- Fast mode — the 2.5-times figure lacked its own supporting quote and `speed` syntax varies by platform → cite the upper bound and document the Foundry deployment exception (F18, F33, F34).
- Worked example — first streamed content could be tool input, and one trace cannot establish p95 → assume a visible acknowledgment, identify the numbers as one trace, and require population measurements (F2, F3).
- Failure modes — an HTTP timer does not necessarily exclude every listed component and a deadline alone does not guarantee cancellation → recommend whole-task timing and propagation without those absolutes (F22, F23).
- Exam lens — a cache miss has causes beyond placement, and asserting what questions will test is speculative → frame both as decision patterns (F6, F12, F13, F26).
- Citation metadata — correct F16's model scope and F25's description of Messages streaming.

## Remaining concerns
- Model availability, effort behavior, fast mode, cache pricing, and service-tier eligibility can change. Recheck the live documentation and deployment platform before implementation.
- The official documentation gives no universal latency guarantee; the example's p95 objectives require workload measurements. Deadline and cancellation propagation depend on the application and its clients.
