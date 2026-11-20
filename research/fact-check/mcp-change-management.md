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
