# Fact-check: 8.4 Organization-Wide Coding Agent Configuration
Checked: 2026-11-19 · Reviewer: GPT-6 Codex
## Summary
33 original citation claims checked against current official docs; 17 supported as written and 16 fixed or narrowed. Removed 3 unsupported or overstated claims. Added 11 citation entries (F34–F44). Checked 2 code blocks; JSON parses and CLI commands/options match current documentation.
## Changes
- Definition and settings precedence — “every developer before any personal preference” overstated scope; define managed policy as organization-wide and highest-precedence for most keys; clarify the managed `availableModels` exception (F1, F2, F38).
- Managed-source resolution — narrowed “silent shadowing” to most keys and retained cross-source exceptions; explained `merge` only when lower sources are administrator-controlled (F5).
- Server-managed settings — limited skip language to documented authentication/provider/routing configurations; removed the unsupported CMEK consequence and broad “fail-open” shorthand; described `forceRemoteSettingsRefresh` as fail-closed startup (F6–F8, F21).
- Permissions and hooks — removed unsupported claims about stripped Skill frontmatter and Agent SDK hook exceptions; use current behavior and order (F9–F12, F29).
- MCP governance — corrected the empty `managed-mcp.json` exception, named HTTP/SSE delivery correctly, and clarified that allowlist exceptions exist for provided, built-in, and in-process SDK servers. Added review guidance for shared MCP servers (F13–F17).
- Telemetry — separated metrics/logs from opt-in beta traces, corrected per-signal endpoint and credential behavior, and narrowed content-redaction claims to documented trace fields. Removed the claim that gateway telemetry bypasses CMEK (F18–F21, F37, F39).
- Gateway routing — kept only supported auth-header and login-lock behaviors; changed the `customEndpoint` example to pin `ANTHROPIC_BASE_URL` in managed `env`; removed unsupported provider analytics assertions (F22–F26, F36).
- Plugin and Skill governance — replaced the invalid `--output json` option with `--json`, removed the unsupported threshold precision, separated manifest validation from eval-baseline evidence, and added version, review, scan, and risk citations (F27–F35, F40–F43).
- ExamLens — retained scenario decision patterns as editorial inference; removed the CMEK-bypass pattern. No pattern is presented as an actual exam item.
- Editorial and verification — defined terms on first use, made Cite placements follow punctuation, validated the illustrative JSON, and built the chapter successfully.
## Remaining concerns
- The 400-engineer LiteLLM/Bedrock configuration is illustrative; its hostnames, credentials, and installed plugin names are placeholders and were not exercised against a live deployment.
