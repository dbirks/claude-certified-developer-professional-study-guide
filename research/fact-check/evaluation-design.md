# Fact-check: 5.1 Evaluation System Design
Checked: 2026-11-19 · Reviewer: GPT-6
## Summary
35 original citation-backed claims checked: 22 supported, 13 fixed for scope or unsupported detail; 1 unsupported clause removed. Citations added: 7 (F36–F42). Code blocks checked: 2 (Python parsed; YAML CLI example checked against current docs and labeled illustrative).
## Changes
- Opening definition and harness — distinguished an agent-plus-harness evaluation from model-only tests and removed the absolute claim that isolation prevents all shared-state leakage (F1–F3, F12).
- Grader trade-offs — replaced unsupported calibration and aggregation claims with current documented grading criteria; added the documented rubric, empirical output, and thinking guidance (F20, F40–F41).
- Golden set, trial isolation, positive/negative cases, reference solutions, and path checks — changed universal rules into evidence-backed recommendations and removed unsupported partial-credit detail (F9–F13, F19).
- CI and plugin-eval details — verified CLI flags, model IDs, isolation, two-arm behavior, and exit-code descriptions; removed unsupported exit-reason details and corrected the example (F22–F25).
- Legacy Console notice — removed the unsupported Playground and redirect assertions; retained the documented Workbench sunset (F21).
- Retrieval and citations — added explicit support for the metric list; clarified that API citations point into supplied documents but do not establish claim truth, and cited token accounting separately (F27–F31, F36, F42).
- Model migrations — scoped prefill support to Claude 4.6+ and Mythos Preview, separated prefix-check behavior from effort-sweep guidance, and cited current docs (F33–F38).
- Contamination — separated the documented eval-awareness cases from the 3.7× multi-agent result and added its exact source quote (F32, F39).
- Exam lens — kept it as decision patterns and added judge calibration against SME labels and position effects, consistent with the sample-item rationale.
- Code and MDX — corrected fenced code languages, parsed the runnable Python block, normalized tables, and checked component boundaries and citations.
## Remaining concerns
- CLI flags and available models can change; the chapter labels its CI sketch illustrative and notes that current values should be checked before adoption.
- The binomial interval in the Python example assumes independent trials. The chapter now states that repeated trials on the same tasks can be correlated and treats the result as illustrative.
- Shadow replay and the recommended private-suite safeguards are engineering practice, not a first-party Messages API feature.
