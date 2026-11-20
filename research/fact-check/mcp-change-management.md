# Fact-check: 2.3 Production MCP and Change Management
Checked: 2026-11-19 · Reviewer: GPT-6
## Summary
42 citation claims reviewed (including the removed entry): 41 supported in the final citation file, 1 unsupported claim removed. Reworded 3 statements for source scope and precision. Citations added: 3 (F40–F42). Code blocks checked: 2; Python parsed successfully. Coverage: all elements in the official objective addressed.

## Changes
- Opening definition — added a current-revision definition of MCP and citation (F40).
- Protocol and transport sections — confirmed handshake vs. stateless revision behavior and distinguished legacy HTTP+SSE deprecation from SSE streaming within Streamable HTTP (F1–F6, F12).
- Authorization and Claude Code scope — checked OAuth requirements, metadata discovery, resource indicators, token validation, downstream token handling, status codes, scope semantics, and the project-scope CLI option (F7–F10, F18–F19, F33, F35–F37, F41).
- Tool catalog section — checked notification behavior by protocol revision and narrowed operational advice to recommendations (F11–F12, F42).
- Messages API connector — removed the unsupported `mcp-client-2026-09-15`/`mcp_tool_listing` pinning claim (F16, UNSUPPORTED); retained documented current beta, public HTTP requirements, toolset configuration, HTTPS URL, tool-only support, and retention scope (F13–F15, F17, F38–F39).
- Model migration — confirmed aliases, fixed IDs, behavior caveat, retirements, Fable 5.2 prefix behavior, platform IDs, and parameter differences. Clarified that the HTTP 400 follows a failed prefix check, while changing the tool list is the edit that can trigger it (F20–F32).
- Prompt versioning — retained version-control and manifest guidance as recommendations; scoped the system-prompt statement to the Claude consumer app (F34).
- Code — checked the Claude Code `--transport http`/`--scope project` example and the Anthropic Python SDK MCP beta fields against official documentation. The Python block is explicitly pseudocode and passed `ast.parse`.
- Coverage and exam lens — addressed remote deployment/authentication, schema versioning, breaking-change tests, platform parity/gateway routing, prompt versioning, and staged rollout/rollback. Kept the ExamLens as editorial decision patterns and found no conflict with the three sample-item rationales in exam-guide §7.

## Claim-by-claim citation status
- SUPPORTED: F1–F15, F17–F42.
- UNSUPPORTED and removed: F16. The current connector page documents `mcp-client-2025-11-20` and toolset allowlisting but did not support the asserted September 2026 listing block/beta.

## Remaining concerns
- Beta headers, model/platform availability, and partner-platform lifecycle details can change; recheck for the deployment’s exact platform at implementation time.
- The connector source is platform-specific; the chapter advises checking current availability rather than implying parity across providers.

## Second pass (GPT-6)

Reviewed 78 cited passages in the resulting chapter: 70 supported as written and 8 corrected or narrowed; removed 0 passages. Added 5 citations (F43–F47). Checked both code blocks; the Python example parses and is labeled pseudocode. Reviewed uncited factual statements, objective coverage, and exam decision patterns.

### Changes

- MCP definition — described its purpose separately from the stateless 2026 core (F40).
- Authentication — clarified that authorization is optional, scoped HTTP 401 to the 2025 profile, and made a URL migration conditional on a change of resource identity (F8, F35, F43).
- Tool definitions — removed the implication that every description is mandatory (F42).
- Connector — corrected the obsolete claim that the November 2025 header is the only current beta. Restored the September 2026 beta’s documented listing and pinning behavior, platform constraint, and unchanged-message requirement (F14, F44, F45).
- Prefix checks — scoped HTTP 400 to the Fable 5.2 default and explained the beta option to drop affected reasoning; clarified that status codes alone do not diagnose a fault (F26, F47).
- Model rollback — explained that on the documented platforms the API drops incompatible thinking blocks and continues without that reasoning (F31, F46).
- Platform table — limited the general model-ID row to the Claude API so it does not conflict with Foundry deployment names (F28, F29).
- Tool migration — recommended testing additions and reconciling notifications; delivery alone does not establish compatibility (F11, F12).
- Exam lens — labeled the scenarios as editorial decision patterns and checked them against all three official sample rationales. All objective elements have explanatory coverage.

### Remaining concerns

- Beta availability and platform behavior can change. Verify the exact deployment and beta headers before release. Quote checks do not establish account access.
