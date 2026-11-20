# Fact-check: 5.2 LLM-as-Judge Engineering
Checked: 2026-11-19 · Reviewer: GPT-6
## Summary
45 cited claims checked: 35 supported as written and 10 fixed for scope, wording, or citation support; 6 groups of unsupported or overly precise uncited claims removed or softened. Citations added: 8. Code blocks checked: 1 Python block parsed. Citation checks: OK; quote checks: 45/45 found; Astro build: passed.
## Changes
- Grader selection and cost — changed “ranks” to “compares” and removed an unsupported claim that dataset authoring is a fixed upfront cost; clarified the documented recurring grading cost (F1–F3, F7).
- Rubric guidance — changed “requires” to “recommends” and aligned the citation quote with Anthropic’s detailed-rubric and multiple-rubric guidance (F4, F12).
- Grading modes — narrowed score-change language to match the paper and added support for reference-guided grading (F27, F40).
- Bias findings — removed the unsupported universal self-preference claim, noted that the study could not establish the effect, and cited the study’s reported human-agreement result without implying it generalizes to all current judges (F29–F32, F43).
- Worked example — removed invented counts, win rates, kappa values, and post-calibration outcomes; replaced the table with a qualitative scenario explicitly labeled illustrative and aligned with the official sample-item rationale (F9, F28, F29).
- Calibration and IRR — removed the unsupported 100–200-item recommendation and 0.80 human-human prerequisite; retained the standard alpha benchmarks with their risk-based qualification and clarified the prevalence limitation of kappa (F14, F33–F37, F42).
- Release gating — removed the unsupported 85% swap, two-percentage-point slot-bias, and nearly-100% regression thresholds; framed acceptance limits as task-specific engineering criteria (F9, F14–F16, F36).
- API and SDK mechanics — added sources for Pydantic parsing, JSON-schema output configuration, refusal response semantics, the Message Batches endpoint, and effort configuration; narrowed thinking-display wording to the documented model scope (F38–F41, F44–F45).
- Model drift — removed unverified platform-specific ID templates and pinned the example to the documented Claude Sonnet 4.6 snapshot ID (F17–F19).
- Exam lens and MDX — kept the ExamLens as editorial decision patterns, escaped literal markup, and retained no fabricated exam questions.
## Remaining concerns
- The code was syntax-checked and its SDK/API identifiers were compared with current Anthropic documentation, but it was not run against a live API request.
- The alpha thresholds come from standard statistical references rather than an Anthropic-prescribed gate; the chapter now says to set thresholds according to decision risk.
- The cited 2023 self-enhancement study explicitly says its data could not determine whether the bias exists; treat it as a possible effect to measure, not a universal property.
