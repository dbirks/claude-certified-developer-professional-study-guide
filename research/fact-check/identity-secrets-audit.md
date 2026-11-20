# Fact-check: 7.3 Identity, Secrets, and Audit at Scale
Checked: 2026-11-19 · Reviewer: GPT-6
## Summary
52 citation entries checked; 52 supported after edits; 12 claim or citation fixes; 2 overstated opener claims removed; 17 citations added; 1 Python code block checked.
## Changes
- Opening definition — identity was conflated with audit evidence and a shared key was said to grant organization-wide access → defined identity as the acting principal and removed the overbroad key claim.
- Workload identity and WIF — API-key and federated-token scope, service-account identity, workspace membership, exchange fields, OAuth scope, lifetime bounds, and credential precedence were clarified and tied to supporting citations (F5, F7–F10, F37, F40–F43, F51, F53–F54).
- Credential table — federated access now follows the matched rule's scope; Admin API keys include Activity Feed access only when the required scope is present (F28, F50).
- MCP authorization — separated the HTTP bearer requirements, stdio credential handling, audience validation, token passthrough prohibition, and Messages API connector fields (F19–F21, F39, F44, F47).
- Secrets — removed the unsupported claim that Compliance Access Key scopes cannot be edited; retained the documented replacement-and-verify rotation sequence and cited Claude Code's CLAUDE.md context behavior (F31, F38).
- Audit logging — clarified tool decision/result behavior, added prompt and tool correlation citations, and cited the Activity Feed read scope (F23–F28, F46, F48, F50, F52).
- Coverage and exam lens — retained decision-pattern framing and covered workload identity, federation, secrets, least-privilege tool policy, and security-action audit evidence against objective 7.3.
- Verification — citation check printed OK; quote check found 0 missing quotes and 0 fetch failures; the Python block parsed; requested Astro build completed; temporary output was removed.
## Remaining concerns
- WIF wizard defaults, token lifetime bounds, and provider/configuration names can change; the chapter flags these for rechecking.
