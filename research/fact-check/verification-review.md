# Fact-check: 8.2 Verification and AI Code Review Operations
Checked: 2026-11-19 · Reviewer: GPT-6

## Summary
Checked all 32 original citation entries and their uses, plus uncited claims and code. All 32 original quotes were found; quote matching alone does not establish support for every claim. Fixed or narrowed claims in 15 passages or groups and removed 4 claim groups or examples. Added 7 citations; checked 1 remaining code block and removed 1 sketch. The revised chapter contains 91 citation placements. Supported and fixed counts overlap because passages combine claims: all 32 source entries have verified quotes, while the passages listed below needed correction or more direct support.

## Changes
- Opening and funnel — F1 describes a bottleneck, not the primary bottleneck; F2's quote does not establish company-wide authorship → narrowed both claims (F1, F2).
- Stop hook — claimed a turn cannot end while tests fail → explained the continuation cap, tool-call reset, and independent CI requirement (F7).
- Verification checks — tests were described as proving behavior universally, and a three-round practice was generalized → described sampled evidence and scoped escalation to the team's workflow (F10, F33).
- Commands and provenance — removed automatic-skill version threshold and attribution-disable details unsupported by the attached quotes (F9, F31).
- Review configuration — implied every check is protected → recommend protecting configuration and distinguish branch selection from protection (F16, F20).
- Review surfaces — conflated a local security command with the GitHub Action and attached an unrelated quote to OIDC and access checks → separated the Action and removed unrelated details (F19, F21).
- Merge gating — missing severity lines can also occur on completed reviews; conversation resolution does not cover every finding → clarified no-verdict handling and inline-comment limitations (F14, F34).
- CI sketch — its selection and failure handling were not a complete gate → removed it and retained documented decision steps (F13, F14, F34).
- Shadow mode — generalized an internal practice and a specific commit gate to all reviewers and gates → scoped both to Anthropic's examples (F23, F24).
- Calibration — the attached quote did not establish incident-derived examples and clean controls; a PR-level flag alone may miss whether the right bug was identified → added direct support, human adjudication and held-out remeasurement (F25, F35).
- Python evaluator — zero denominators raised accidental errors → reject undefined metrics and handle zero F1; thresholds and counts remain illustrative.
- Convergence — a three-round limit was described as an unconditional enforced cap → state that the reviewer asks the author to reconsider (F36).
- Human oversight — presented one team's tiers as universal and implied CODEOWNERS was an extra approval → scoped the tiers and added table citations (F29, F37–F39).
- Exam lens — retained editorial decision patterns and corrected the choice of severity parsing or thread resolution; added human-label calibration before gating.
- Diagram and editorial pass — removed a guarantee about incident rates, defined the funnel and calibration, softened test claims, and trimmed unsupported details.

## Remaining concerns
- Product limits, prices, availability and version-sensitive behavior may change after the review date. Some original excerpts are narrower than the full linked official pages, which were consulted where necessary.
- The evaluator is PR-level and uses hypothetical labels. Production evaluation should score the correctness of each finding and use independently adjudicated, representative data; thresholds are not prescribed by Anthropic.
