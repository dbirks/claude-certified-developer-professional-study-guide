# Fact-check: 1.3 Architecture Selection at Scale
Checked: 2026-11-19 · Reviewer: OpenAI GPT-6 Codex

## Summary
Checked 62 final citation placements against their quotes and context; all 62 are supported as revised. Made 8 substantive claim or citation-scope fixes and removed 2 unsupported or repeated assertions; these counts overlap with the reviewed placements. Added 1 citation; checked 0 fenced code blocks. Inline SDK and CLI syntax was checked against official documentation. The objective covers measurement, migration in both directions, and selection of harnesses, frameworks, and reusable standards. Exam lens items are editorial decision patterns and do not contradict the three sample rationales.

## Changes
- Workflow and agent definitions — choosing a tool on every turn overstates the definition → describe dynamic action and completion decisions (F1, F2).
- Starting principle — repeated the same recommendation → retain it once (F3).
- Multi-agent suitability — missing definition and scope of research finding → define the pattern and attribute limitations to the research (F7, F9).
- Pattern table — a workflow can branch and its call count need not be fixed; one call is not universally the cheapest → describe path-dependent calls and recommend measurement (F3, F5).
- Hypothetical failure rates — aggregate counts cannot prove why task exposure differed → report the observed difference without asserting causation (editorial arithmetic).
- Tool runner construction — the prior quote supported the iteration bound but not the Python method name → add the documented method citation (F27, F31).
- Runner state — default message history alone does not prove persistence or hosting guarantees → recommend provisioning durable storage and retain the documented default (F12).
- Project Skill path — source quote omitted the path and cloud-thread condition → quote the complete source table row (F20).
- Hook and portability statements — citations documented hook behavior and Claude Code paths, not universal security or discovery guarantees → separate documented behavior from recommendations (F20–F23).
- Exam lens — implicit editorial framing → explicitly identify decision patterns as editorial inference.

## Remaining concerns
- Agent SDK and third-party framework versions, persistence, isolation, and Skill portability are deployment-specific and remain unpinned; verify the selected release.
- The quote verifier accepted four quotations with loose matching; the relevant official pages were also consulted. The Python method quote is a short code fragment because the source presents the identifier in an example.
