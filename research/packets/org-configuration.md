# 8.4 Organization-Wide Coding Agent Configuration

Applying enterprise configuration for organizations adopting coding agents, including managed settings and policies, MCP allowlists, telemetry, gateway routing, and governance with a quality and safety bar for sharing prompts, Skills, and MCP servers across teams.

## Scope map

- **Managed settings and policies** → Core facts; Exact API / config details (§ Settings hierarchy, Managed-only keys, Permissions & hooks, Cloud providers); Practitioner reasoning; Worked example; Diagram spec; Exam lens; Common mistakes.
- **MCP allowlists** → Core facts; Exact API / config details (§ MCP governance); Practitioner reasoning; Worked example; Exam lens; Common mistakes.
- **Telemetry** → Core facts; Exact API / config details (§ Telemetry configuration); Practitioner reasoning; Worked example; Exam lens; Common mistakes.
- **Gateway routing** → Core facts; Exact API / config details (§ Gateway routing); Practitioner reasoning; Worked example; Diagram spec; Exam lens; Common mistakes.
- **Governance with a quality and safety bar for sharing prompts, Skills, and MCP servers across teams** → Core facts; Exact API / config details (§ Plugins and marketplaces, Skills governance, CLAUDE.md memory hierarchy vs enforced controls); Practitioner reasoning; Worked example; Exam lens; Common mistakes; Self-check.

## Core facts

- Claude Code resolves configuration through a five-level settings stack, highest precedence first: managed settings, command-line `--settings`, project local (`.claude/settings.local.json`), shared project (`.claude/settings.json`), and user (`~/.claude/settings.json`). (F1)
- Array keys such as `permissions.allow` and `permissions.deny` merge across scopes rather than overriding, while replacement keys such as `fallbackModel`, `availableModels` (when set in managed settings), and `modelPicker` replace lower scopes. (F2)
- Endpoint-managed settings live in OS-specific system paths (`managed-settings.json` plus optional `managed-settings.d/*.json` drop-ins) or native OS policy stores (macOS `com.anthropic.claudecode` plist; Windows `HKLM` / `HKCU` registry). (F3) (F4)
- Within the managed tier, Claude Code ranks remote server-managed settings first, then MDM/OS policies, then `managed-settings.json` / `managed-settings.d/`, and finally user-writable Windows `HKCU`. By default (`managedSourcesBehavior: "first-wins"`), the highest-ranked source delivering any policy key wins and lower sources are skipped, except for cross-source lock keys and per-variable `env` merging; setting `managedSourcesBehavior: "merge"` composes all admin sources. (F5)
- Server-managed settings are configured in the claude.ai admin console (Team/Enterprise) and fetched at startup and hourly during active sessions. They are skipped whenever `apiKeyHelper`, Workload Identity Federation, a cloud provider flag (`CLAUDE_CODE_USE_*`), or a custom `ANTHROPIC_BASE_URL` is active, and do not apply to Cowork sessions. (F6) (F7)
- Server-managed settings use a 24-hour fail-open cache by default (withholding proxy, CA, base URL, and credential `env` vars until the server confirms the payload); setting `forceRemoteSettingsRefresh: true` enforces fail-closed startup. (F8)
- Permission rules evaluate in strict order—`deny`, then `ask`, then `allow`—across all scopes, so a `deny` rule at any level blocks an `allow` rule anywhere else. (F9)
- Setting `allowManagedPermissionRulesOnly: true` makes managed settings the sole settings source of permission rules, ignoring user/project/local/`--settings` rules, `--allowedTools`, and skill `allowed-tools` frontmatter; `permissions.disableBypassPermissionsMode: "disable"` and `permissions.disableAutoMode: "disable"` disable those modes. (F10) (F11)
- Project-committed `permissions.allow` rules and `additionalDirectories` in `.claude/settings.json` wait for interactive workspace trust before taking effect, whereas `deny` and `ask` rules apply immediately. (F12)
- For MCP governance, `managed-mcp.json` takes exclusive control (blocking user, project, plugin, and `--mcp-config` servers; an empty map disables MCP), `managedMcpServers` pushes HTTPS/SSE servers alongside user-added ones, and `allowedMcpServers` + `allowManagedMcpServersOnly: true` enforces an approved catalog while `deniedMcpServers` always merges across all scopes and overrides every allowlist. (F13) (F14) (F15) (F17)
- `serverName` in `allowedMcpServers`/`deniedMcpServers` matches only the user-chosen label and is not a security control; enforceable policies must match on `serverUrl` or exact `serverCommand` arrays. (F16)
- Claude Code exports OpenTelemetry metrics, log events, and beta traces when `CLAUDE_CODE_ENABLE_TELEMETRY=1`; repository `.claude/settings.json` and `.claude/settings.local.json` are ignored for OTel exporter variables, and managed OTLP endpoint/credential variables strip conflicting developer per-signal overrides at startup. (F18) (F19)
- Sensitive OTel content—user prompts, assistant responses, tool details/arguments, tool outputs, and raw API bodies—is redacted or omitted by default and requires explicit opt-in flags. (F20)
- `DISABLE_TELEMETRY=1` in managed settings disables Anthropic-bound operational telemetry (required when using CMEK with a custom gateway). (F21)
- Routing Claude Code through an LLM gateway uses `ANTHROPIC_BASE_URL` plus `ANTHROPIC_AUTH_TOKEN` (`Authorization: Bearer`), `ANTHROPIC_API_KEY` (`x-api-key`), or `apiKeyHelper` (sent in both headers, 5-minute default cache TTL). LiteLLM implements `/v1/messages` directly for this flow, while Anthropic's built-in `Claude apps gateway` (`claude gateway`) adds OIDC SSO, per-IdP-group managed policies, and OTLP telemetry in front of Bedrock, Vertex, Foundry, or the Anthropic API. (F22) (F23) (F25)
- To pin a fleet exclusively to a gateway, set `allowedProviders: ["customEndpoint"]` alongside `ANTHROPIC_BASE_URL` in managed settings, and never pair gateway credentials with `forceLoginMethod` or `forceLoginOrgUUID` (which block startup). (F24)
- Cloud provider deployments (Amazon Bedrock, Google Cloud's Agent Platform / Vertex AI, Microsoft Foundry) require explicit model pinning (`ANTHROPIC_DEFAULT_*_MODEL`) to prevent silent fallback or broken aliases across fleet upgrades, and lack claude.ai server-managed settings and Analytics dashboard/API. (F26)
- Organizations govern plugins and marketplaces with `strictKnownMarketplaces`, `blockedMarketplaces`, `extraKnownMarketplaces`, `enabledPlugins`, `disableSideloadFlags`, `disableCommandPluginSources`, `strictPluginOnlyCustomization`, and `syncClaudeAiPlugins`, because plugins execute hooks, monitors, mods, stdio MCP/LSP servers, and `bin/` tools outside Claude Code's tool permission and sandbox model. (F27) (F28)
- `allowManagedHooksOnly: true` blocks user, project, local, agent-frontmatter, and non-force-enabled plugin hooks while exempting managed hooks, Agent SDK in-process hooks, and plugins force-enabled via managed `enabledPlugins`. (F29)
- `CLAUDE.md` files (managed policy, user, project/AGENTS.md, local) load as context into the conversation to guide behavior; they are not a hard security or policy enforcement layer—deterministic restrictions belong in `managed-settings.json` and hooks. (F30)
- Custom Skills do not sync across surfaces (API `/v1/skills` vs claude.ai vs Claude Code), so organizations must keep Git as the source of truth, pin production Skill versions, enforce a security review checklist (with separation of duties and enterprise content scanning where available), and gate Skills/plugins with eval suites (`3–5` test cases across models; `claude plugin validate --strict` and `claude plugin eval` against a no-plugin baseline). (F31) (F32) (F33)

## Exact API / config details

### Settings hierarchy, OS paths, and managed precedence

- **Five-tier precedence (highest to lowest):** (F1)
  1. Managed settings (remote server-managed → MDM/plist/`HKLM` → `managed-settings.json` + `managed-settings.d/*.json` → Windows `HKCU`) (F5)
  2. CLI `--settings <file-or-json>`
  3. Project local (`.claude/settings.local.json`)
  4. Shared project (`.claude/settings.json`)
  5. User (`~/.claude/settings.json`; or `%USERPROFILE%\.claude\settings.json` on Windows, overridden by `CLAUDE_CONFIG_DIR`)
- **System paths for file-based managed policy (`managed-settings.json`, `managed-settings.d/*.json`, `managed-mcp.json`, managed `CLAUDE.md`):** (F3)
  - macOS: `/Library/Application Support/ClaudeCode/` (MDM domain: `com.anthropic.claudecode`) (F3) (F4)
  - Linux / WSL: `/etc/claude-code/`
  - Windows: `C:\Program Files\ClaudeCode\` (Registry: `HKLM\SOFTWARE\Policies\ClaudeCode` `Settings` `REG_SZ`/`REG_EXPAND_SZ`; legacy `C:\ProgramData\ClaudeCode\` is not read) (F3)
  - Drop-in merge order: `managed-settings.json` first, then `managed-settings.d/*.json` alphabetically (ignore hidden/non-`.json`).
  - WSL inheritance: `wslInheritsWindowsSettings: true` in `HKLM` or Windows `managed-settings.json` extends Windows policy to WSL.
- **Managed source combination (`managedSourcesBehavior`):**
  - Default `"first-wins"`: first source delivering any policy key (excluding `wslInheritsWindowsSettings` and `managedSourcesBehavior`) supplies the policy; lower sources are ignored except cross-source lock keys and per-variable `env` merging (v2.1.223+). (F5)
  - `"merge"` (v2.1.242+): set in highest-ranked source; unions lists (`permissions.allow`, `hooks`, `deniedMcpServers`, `deniedModels`), applies strictest lock values (`allowManagedHooksOnly`, `permissions.disableBypassPermissionsMode`), takes restriction allowlists whole from highest-ranked setter (`availableModels`, `allowedMcpServers`, `strictKnownMarketplaces`, `fallbackModel`), and takes `modelPicker`, `permissions.defaultMode`, and `apiKeyHelper` from highest-ranked source only. (F5)
- **Strict-wins exceptions (lower scope overrides managed when stricter):** `disableClaudeAiConnectors: true`, `enableArtifact: false`, `isolatePeerMachines: true`, `permissions.blockReadsOutsideWorkingDirectories: true`, `permissions.blockWritesOutsideWorkingDirectories: true`, `remoteControlAtStartup: false` (project/local), `syncClaudeAiSkills: false` / `syncClaudeAiPlugins: false` / `useAutoModeDuringPlan: false` (user/local/`--settings`), `maxEffortLevel` (lowest cap wins).
- **Server-managed delivery & caching:**
  - Startup fetch + hourly background poll; 24-hour cache TTL at `~/.claude/remote-settings.json`. (F6)
  - Withheld from cache until server confirms payload: proxy/TLS (`HTTPS_PROXY`, `NODE_EXTRA_CA_CERTS`, `CLAUDE_CODE_CLIENT_CERT/KEY`), routing (`ANTHROPIC_BASE_URL`, `CLAUDE_CODE_USE_*`), credentials (`ANTHROPIC_API_KEY`, `ANTHROPIC_AUTH_TOKEN`, `CLAUDE_CODE_OAUTH_TOKEN`), WIF vars, `CLAUDE_CONFIG_DIR`, `managedMcpServers`, `modelPricing`.
  - `forceRemoteSettingsRefresh: true`: blocks startup until fresh fetch succeeds (sends `Cache-Control: no-cache`); exits on failure (exempts `claude auth` subcommands). (F8)
  - Security approval dialogs trigger on shell helpers (`apiKeyHelper`, `statusLine`, `otelHeadersHelper`), hooks, sandbox binaries/weakening flags, and sensitive `env` vars (`ANTHROPIC_BASE_URL`, `OTEL_EXPORTER_OTLP_ENDPOINT`, `CLAUDE_CODE_DISABLE_1M_CONTEXT`); non-interactive (`-p`, Agent SDK) applies for that run without caching approval.
  - Verification commands: `/status` (`Setting sources` shows `Enterprise managed settings (remote|plist|HKLM|file|drop-ins|helper)` plus `Skipped sources`), `claude doctor` (`Managed settings (remote)` line).

### Managed-only keys and permissions / hooks policy

- **Core managed-only keys** (ignored in user/project/local settings): (F10) (F15) (F27) (F29)
  - Permissions & execution: `allowManagedPermissionRulesOnly`, `allowManagedHooksOnly`, `disableSideloadFlags`, `disableCommandPluginSources`, `strictPluginOnlyCustomization` (`true` or array of `["skills", "agents", "hooks", "mcp"]`), `allowedProviders` (e.g. `["bedrock"]`, `["customEndpoint"]`), `processWrapper`.
  - MCP: `allowManagedMcpServersOnly`, `managedMcpServers`, `allowAllClaudeAiMcps`, `allowClaudeInChromeWithManagedMcp`.
  - Marketplaces & plugins: `strictKnownMarketplaces` (alias `allowedMarketplaces`), `blockedMarketplaces`, `pluginSuggestionMarketplaces`, `pluginTrustMessage`, `allowedChannelPlugins`, `channelsEnabled`.
  - Sandbox locks: `sandbox.network.allowManagedDomainsOnly`, `sandbox.filesystem.allowManagedReadPathsOnly`.
  - Delivery & lifecycle: `forceRemoteSettingsRefresh`, `managedSourcesBehavior`, `parentSettingsBehavior`, `policyHelper`, `wslInheritsWindowsSettings`, `claudeMd`.
- **Permissions policy syntax & lockdowns:**
  - Evaluation order: `deny` → `ask` → `allow`. Bare tool `deny` (e.g., `"Bash"`, `"mcp__*"`) removes the tool from model context; scoped `deny` (e.g., `"Bash(curl *)"`, `"Read(./.env)"`) blocks matching calls. (F9)
  - `allowManagedPermissionRulesOnly: true`: ignores `allow`/`ask`/`deny` in user/project/local/`--settings`, ignores `--allowedTools`, hides "always allow" prompt UI, and strips `allowed-tools` frontmatter from repo/user/synced/`--add-dir` skills (v2.1.282+). (`--disallowedTools` still applies as extra restriction.) (F10)
  - `permissions.disableBypassPermissionsMode: "disable"` blocks `--dangerously-skip-permissions` / `bypassPermissions`; `permissions.disableAutoMode: "disable"` blocks `auto` mode. (F11)
  - `permissions.defaultMode`: `auto` and `bypassPermissions` are ignored in project/local settings (must be user/managed or `--permission-mode`).
- **Hooks policy:**
  - `allowManagedHooksOnly: true` blocks user, project, local, agent-frontmatter, and user-installed plugin hooks; allows managed hooks, Agent SDK in-process hooks, and hooks in plugins force-enabled by managed `enabledPlugins` (`plugin@marketplace`). Also narrows `statusLine`/`fileSuggestion` to managed settings, blocks `command` plugin sources and `headersHelper` unless `disableCommandPluginSources: false`, and disables `/goal`. (F29)
  - `allowedHttpHookUrls` and `httpHookAllowedEnvVars` restrict HTTP hook targets and interpolated env vars (note: these merge across settings files if set lower, so managed settings don't erase lower entries unless managed hooks are locked).
  - `PreToolUse` hooks cannot override `permissions.deny` or `ask` rules; `disableAllHooks: true` outside managed settings cannot disable managed hooks.

### MCP governance (`managed-mcp.json`, `managedMcpServers`, allowlists/denylists)

- **Exclusive mode (`managed-mcp.json`):** deployed to OS system dir (cannot be delivered via server-managed settings); blocks all user, project `.mcp.json`, plugin, and `--mcp-config` servers (workstations exit on `--mcp-config`). `{ "mcpServers": {} }` disables MCP entirely. Use `allowAllClaudeAiMcps: true` to keep claude.ai connectors or `allowClaudeInChromeWithManagedMcp: true` (device policy only) to keep Chrome. Never hardcode secrets in `env` (file is world-readable on disk)—use `${VAR}` expansion, OAuth, or `headersHelper`. (F13)
- **Additive provision (`managedMcpServers`):** object keyed by server name (`type: "http"` or `"sse"`, `https://` URLs only—`http://localhost` rejected; no `command`, `args`, `env`, `headersHelper`, or `${VAR}`). Precedence over same-name user/project/plugin entries; users can toggle off in `/mcp` but cannot `claude mcp remove`. Skips `allowedMcpServers` check. (F14)
- **Allowlist & denylist (`allowedMcpServers` + `allowManagedMcpServersOnly: true`, `deniedMcpServers`):** (F15) (F16) (F17)
  - Unset `allowedMcpServers` = all allowed; `[]` = none allowed (except `managedMcpServers`, non-`${VAR}` `managed-mcp.json`, built-ins, `type: "sdk"`).
  - Entry shapes: `{ "serverUrl": "https://*.internal.example.com/*" }` (exact hostname = default port 443/80 only; `*` in hostname = any port; `:*` = any port), `{ "serverCommand": ["npx", "-y", "@scope/pkg"] }` (exact array match; `env` not compared), `{ "serverName": "name" }`.
  - **Evaluation trap:** Once `allowedMcpServers` has any `serverUrl` entry, remote servers ignore `serverName` entries and must match a `serverUrl`; once it has any `serverCommand` entry, stdio servers ignore `serverName` entries and must match a `serverCommand`. `deniedMcpServers` always merges across all scopes and overrides allowlists, `managed-mcp.json`, and `managedMcpServers`. (F16) (F17)

### Telemetry configuration for organizations

- **OTel activation & exporters (`env` block in managed settings):**
  - `CLAUDE_CODE_ENABLE_TELEMETRY=1`, `OTEL_METRICS_EXPORTER=otlp` (`otlp|prometheus|console|none`), `OTEL_LOGS_EXPORTER=otlp` (`otlp|console|none`), plus for traces (beta): `CLAUDE_CODE_ENHANCED_TELEMETRY_BETA=1` and `OTEL_TRACES_EXPORTER=otlp`. (F18)
  - Endpoint & auth: `OTEL_EXPORTER_OTLP_PROTOCOL` (`grpc`, `http/protobuf`, `http/json`), `OTEL_EXPORTER_OTLP_ENDPOINT`, `OTEL_EXPORTER_OTLP_HEADERS` (or per-signal `*_METRICS_*`, `*_LOGS_*`, `*_TRACES_*`), or dynamic HTTP auth via `otelHeadersHelper` (refreshed every 29m / `CLAUDE_CODE_OTEL_HEADERS_HELPER_DEBOUNCE_MS`, HTTP protocols only).
  - mTLS: `OTEL_EXPORTER_OTLP_CLIENT_KEY` / `_CERTIFICATE` / `_CERTIFICATE` CA for gRPC; `CLAUDE_CODE_CLIENT_CERT` / `_KEY` + `NODE_EXTRA_CA_CERTS` for HTTP.
- **Managed locking & anti-bypass:**
  - Repository `.claude/settings.json` and `.claude/settings.local.json` ignore all OTel exporter variables (though a repo can set `OTEL_LOGS_EXPORTER=none` unless locked by managed/CLI/shell). (F19)
  - Setting `OTEL_EXPORTER_OTLP_ENDPOINT`, `_PROTOCOL`, or credentials (`_HEADERS`, `_CLIENT_KEY`, `_CLIENT_CERTIFICATE`) in managed settings strips developer-set per-signal endpoints/credentials at startup. Set `OTEL_METRICS_EXPORTER` / `OTEL_LOGS_EXPORTER` / `OTEL_TRACES_EXPORTER` in managed settings too so developers cannot switch signals to `none` or `console`.
  - `OTEL_*` variables are not passed to spawned Bash/hook/MCP subprocesses (`TRACEPARENT` is passed when tracing is active and `ANTHROPIC_BASE_URL` is default or `CLAUDE_CODE_PROPAGATE_TRACEPARENT=1`).
- **Privacy & cardinality controls:**
  - Content toggles (all off by default): `OTEL_LOG_USER_PROMPTS=1`, `OTEL_LOG_ASSISTANT_RESPONSES=1`, `OTEL_LOG_TOOL_DETAILS=1` (reveals Bash commands, MCP server/tool names, plugin/skill names, tool inputs; without it third-party plugin names emit as `third-party` or omit), `OTEL_LOG_TOOL_CONTENT=1`, `OTEL_LOG_RAW_API_BODIES=1` (`61440` chars / 60 KB default truncation via `CLAUDE_CODE_OTEL_CONTENT_MAX_LENGTH`). (F20)
  - Resource & cardinality: `OTEL_RESOURCE_ATTRIBUTES` (custom team/org/host tags), `OTEL_RESOURCE_INCLUDE_HOST=1` (`host.name`, `host.id`), `OTEL_METRICS_INCLUDE_SESSION_ID`, `OTEL_METRICS_INCLUDE_ACCOUNT_UUID`, `OTEL_METRICS_INCLUDE_REPOSITORY`.
  - Operational telemetry opt-out: `DISABLE_TELEMETRY=1` (or `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=1` which also disables auto-updater) in managed `env`. Required if using CMEK with a custom gateway because Anthropic operational telemetry on gateway sessions bypasses CMEK. (F21)

### Gateway routing and cloud provider config

- **Generic LLM Gateway (`ANTHROPIC_BASE_URL`):**
  - `ANTHROPIC_BASE_URL`: base URL without trailing redirect (redirects strip bodies/creds and break model discovery).
  - Auth headers: `ANTHROPIC_AUTH_TOKEN` → `Authorization: Bearer`; `ANTHROPIC_API_KEY` → `x-api-key`; `apiKeyHelper` → **both** headers (command prints raw credential only to stdout; cached 5 min default via `CLAUDE_CODE_API_KEY_HELPER_TTL_MS`, refreshes on 401/403). (F22)
  - **Pinning & conflicts:** set `allowedProviders: ["customEndpoint"]` + `ANTHROPIC_BASE_URL` in managed settings (v2.1.285+) to reject direct Anthropic or unauthorized proxies. Never set `forceLoginMethod` or `forceLoginOrgUUID` with gateway credentials (blocks startup). (F24)
  - Optional gateway env vars: `ANTHROPIC_CUSTOM_HEADERS` (`Name: Value\n...`), `CLAUDE_CODE_GATEWAY_HINT_HEADERS`, `CLAUDE_CODE_ENABLE_GATEWAY_MODEL_DISCOVERY=1` (queries `GET /v1/models`), `CLAUDE_CODE_DISABLE_EXPERIMENTAL_BETAS=1` (when upstream rejects beta fields), `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=1` + `skipWebFetchPreflight: true` (air-gapped egress), `CLAUDE_CODE_SKIP_FAST_MODE_NETWORK_ERRORS=1` / `_ORG_CHECK=1`.
  - **LiteLLM pattern:** LiteLLM serves `/v1/messages` natively; point `ANTHROPIC_BASE_URL` at proxy URL, `ANTHROPIC_AUTH_TOKEN` at a per-developer LiteLLM virtual key, and optional `ANTHROPIC_MODEL`. (Note: Anthropic does not support routing Claude Code to non-Claude models through any gateway.) (F23)
  - **Claude apps gateway (`claude gateway --config gateway.yaml`):** Built into Linux/macOS `claude` binary (v2.1.195+); requires OIDC IdP, PostgreSQL 11+, HTTPS on a private IP (`gatewayInternalNetworks` if org owns public IPv4). Translates Anthropic Messages API to Bedrock/Vertex/Foundry/Anthropic API, enforces IdP-group `availableModels` and `managed` settings, and emits OTLP metrics. Does not support CI service tokens (browser SSO only). (F25)
- **Cloud provider configurations (when connecting directly or via provider-specific gateway):**
  - **Amazon Bedrock:** `CLAUDE_CODE_USE_BEDROCK=1`, `AWS_REGION` (fallback `AWS_DEFAULT_REGION` → profile → `us-east-1`), AWS SDK credential chain or `AWS_BEARER_TOKEN_BEDROCK` (bypasses chain); `awsAuthRefresh` (runs after STS `GetCallerIdentity` fails) / `awsCredentialExport` (runs at start/reload); `ANTHROPIC_BEDROCK_REGION_PREFIX` (e.g. `eu`) or `ANTHROPIC_DEFAULT_*_MODEL`; gateway override `ANTHROPIC_BEDROCK_BASE_URL` + `CLAUDE_CODE_SKIP_BEDROCK_AUTH=1`. WebSearch unavailable. (F26)
  - **Google Cloud's Agent Platform (Vertex AI):** `CLAUDE_CODE_USE_VERTEX=1`, `CLOUD_ML_REGION` (e.g. `global` or `us-east5`), `ANTHROPIC_VERTEX_PROJECT_ID`, ADC / `GOOGLE_APPLICATION_CREDENTIALS` / `gcpAuthRefresh` (5s check, 3m timeout), per-model `VERTEX_REGION_CLAUDE_*`; gateway override `ANTHROPIC_VERTEX_BASE_URL` + `CLAUDE_CODE_SKIP_VERTEX_AUTH=1`. (F26)
  - **Microsoft Foundry:** `CLAUDE_CODE_USE_FOUNDRY=1`, `ANTHROPIC_FOUNDRY_RESOURCE` (resource name only, not URL) or `ANTHROPIC_FOUNDRY_BASE_URL`, Entra ID default chain (`Foundry User` / `Cognitive Services User` RBAC) or `ANTHROPIC_FOUNDRY_AUTH_TOKEN` (`Bearer`, highest precedence) or `ANTHROPIC_FOUNDRY_API_KEY` (`x-api-key`); `CLAUDE_CODE_SKIP_FOUNDRY_AUTH=1` for header-injecting gateways; `modelOverrides` maps deployment names to Claude IDs for 1M context detection. No interactive setup wizard; Tool search unsupported on Azure-hosted deployments. (F26)
  - **Parity caveat:** Server-managed settings from claude.ai, Analytics dashboard/API, cloud sessions, and Code Review are unavailable when authenticating via Bedrock, Google-managed Agent Platform, or Foundry. (F26)

### Plugins, marketplaces, Skills, and `CLAUDE.md` governance

- **Plugins & marketplaces:**
  - Provisioning: `extraKnownMarketplaces` + `enabledPlugins` (`true` force-enables, `false` blocks/hides across all scopes).
  - Lockdowns: `strictKnownMarketplaces` (alias `allowedMarketplaces`; `[]` blocks all, `{ "source": "github", "repo": "your-org/*" }`, `{ "source": "hostPattern", "hostPattern": "^github\\.example\\.com$" }`, `{ "source": "skills-dir" }` required to keep `.claude/skills/` manifest plugins active); `blockedMarketplaces` (checked first; canonicalizes `git@`/`https://`/`.git`); `disableSideloadFlags: true` (rejects `--plugin-dir`, `--plugin-url`, `--agents`, `--mcp-config`, `CLAUDE_CODE_PLUGIN_DIRS`, SDK `plugins`/`addPlugins`); `disableCommandPluginSources: true` (default matches `allowManagedHooksOnly`); `strictPluginOnlyCustomization: true` (blocks user/project skills, agents, hooks, MCP servers outside plugins); `syncClaudeAiPlugins: false` (stops claude.ai synced plugins). (F27) (F28)
  - Air-gapped / CI seeding: pre-populate with `CLAUDE_CODE_PLUGIN_CACHE_DIR=/opt/claude-seed claude plugin ...`, then mount read-only at runtime with `CLAUDE_CODE_PLUGIN_SEED_DIR=/opt/claude-seed` + `enabledPlugins` (still subject to `strictKnownMarketplaces`).
- **Skills sharing & quality/safety bar:**
  - Scopes (command precedence): Enterprise (`.claude/skills/<name>/SKILL.md` in managed system dir) > Personal (`~/.claude/skills/`) > Project (`.claude/skills/`) > `--add-dir` > Plugin (`/plugin:skill`) > claude.ai synced (`~/.claude/skills/synced/`, blocked via `syncClaudeAiSkills: false`).
  - Cross-surface isolation: API Skills (`/v1/skills`, max 20 per request) do not sync to claude.ai or Claude Code. Store Skills in Git, compute checksums/signed commits, and pin explicit `version` in production API calls (omitting `version` pulls latest immediately). (F31)
  - **Quality & safety bar:** (1) Risk-tier assessment (code execution scripts, instruction manipulation, MCP refs, network calls, hardcoded credentials = High risk); (2) 8-step review checklist + separation of duties (author ≠ reviewer); (3) Automated Enterprise "Skill and plugin security scanning" in claude.ai/Cowork (blocks failed/pending scans; not available for `/v1/skills` API, CMEK, ZDR, or HIPAA); (4) Pre-release validation: `claude plugin validate --strict`, evaluation suites of 3–5 queries (trigger, non-trigger, edge cases) tested across Haiku/Sonnet/Opus, and `claude plugin eval` comparing `WITH` vs `W/OUT` no-plugin baseline (`Δ`). (F32) (F33)
- **`CLAUDE.md` memory hierarchy vs. enforced controls:**
  - Load order (all concatenated, root down to CWD): Managed policy (`CLAUDE.md` in OS system dir, or inline `claudeMd` key in managed settings) → User (`~/.claude/CLAUDE.md` + `~/.claude/rules/`) → Project (`./CLAUDE.md` or `./.claude/CLAUDE.md` + `.claude/rules/`, or `./AGENTS.md` if no CLAUDE.md exists) → Local (`./CLAUDE.local.md`), plus on-demand subdirectory `CLAUDE.md` and path-scoped `.claude/rules/`. `claudeMdExcludes` skips monorepo ancestor files by glob but cannot exclude managed `CLAUDE.md`.
  - **Architectural boundary:** `CLAUDE.md` is injected as user-message context (shape behavior, coding standards, architecture); `managed-settings.json` (`permissions.deny`, `sandbox.*`, `allowManagedHooksOnly`, `allowedMcpServers`, `PreToolUse` hooks) enforces deterministic client-side controls regardless of model reasoning. (F30)

## Practitioner reasoning

- **[INFERENCE] Separate endpoint enforcement from server-managed convenience.** Server-managed settings are ideal for zero-MDM claude.ai Team/Enterprise fleets, but because they are client-side fetched from `api.anthropic.com` and skipped whenever a cloud provider or custom `ANTHROPIC_BASE_URL` is active, regulated enterprises and multi-provider fleets must deploy MDM/OS-level policies (`com.anthropic.claudecode` plist on macOS, `HKLM` on Windows, `/etc/claude-code/managed-settings.json` on Linux) or run `Claude apps gateway`. (F4) (F6) (F7)
- **[INFERENCE] Beware `"first-wins"` silent shadowing across managed tiers.** Because `managedSourcesBehavior` defaults to `"first-wins"`, adding a single unrelated key in the claude.ai console (server-managed) causes Claude Code to silently ignore an entire MDM `managed-settings.json` except for cross-source locks and per-variable `env` keys. Either standardize on one managed source, inspect `/status` (`Skipped sources`), or explicitly set `managedSourcesBehavior: "merge"` in the top source. (F5)
- **[INFERENCE] Defense-in-depth requires sandboxing + permissions + MCP/plugin lockdowns together.** Denying `WebFetch` or `Bash(curl *)` only checks command text (`sh -c 'curl ...'` or `/usr/bin/curl` bypasses `Bash(curl *)`); OS-level sandboxing (`sandbox.enabled: true` + `sandbox.network.allowManagedDomainsOnly: true`) closes the network/filesystem gap, while `strictKnownMarketplaces` + `disableSideloadFlags` + `allowManagedHooksOnly` closes the plugin/hook arbitrary-code gap. (F10) (F27) (F28) (F29)
- **[INFERENCE] Balance telemetry debuggability against secret/PII leakage.** Leaving `OTEL_LOG_TOOL_DETAILS`, `OTEL_LOG_USER_PROMPTS`, and `OTEL_LOG_RAW_API_BODIES` at their default disabled state gives token/cost/session/tool-decision observability without leaking source code, `.env` reads, or secrets into metrics/SIEM pipelines. Enable `OTEL_LOG_TOOL_DETAILS=1` only when the OTLP collector/SIEM is approved for command arguments and third-party MCP/plugin names. (F20)
- **[INFERENCE] Treat Skills, prompts, and MCP servers with software-supply-chain rigor.** Because Skills can instruct Claude to invoke tools and plugins run unsandboxed hooks/MCP stdio servers, sharing across teams requires Git-backed code review (author ≠ reviewer), deterministic `claude plugin validate --strict`, behavioral evals (`claude plugin eval` proving positive `Δ` over baseline), and strict pinning (`sha256` archives, `version` on `/v1/skills`, exact `serverUrl`/`serverCommand` allowlists). (F16) (F28) (F31) (F32) (F33)

## Worked example

**Scenario:** A 400-engineer organization runs Claude Code across macOS/Linux laptops and GitHub Actions CI, routing inference through an internal **LiteLLM** gateway backed by Amazon Bedrock, while restricting MCP servers, plugins, hooks, and telemetry via MDM-deployed endpoint-managed settings (because `ANTHROPIC_BASE_URL` disables claude.ai server-managed settings). (F3) (F7) (F23)

**1. Endpoint-managed policy (`/etc/claude-code/managed-settings.json` on Linux, `/Library/Application Support/ClaudeCode/managed-settings.json` on macOS):**

```json
// Illustrative enterprise managed-settings.json schema (verify keys against current CLI version)
{
  "allowedProviders": ["customEndpoint"],
  "env": {
    "ANTHROPIC_BASE_URL": "https://litellm.internal.corp",
    "CLAUDE_CODE_DISABLE_EXPERIMENTAL_BETAS": "1",
    "CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC": "1",
    "CLAUDE_CODE_ENABLE_TELEMETRY": "1",
    "OTEL_METRICS_EXPORTER": "otlp",
    "OTEL_LOGS_EXPORTER": "otlp",
    "OTEL_EXPORTER_OTLP_PROTOCOL": "http/protobuf",
    "OTEL_EXPORTER_OTLP_ENDPOINT": "https://otel-collector.internal.corp:4318",
    "OTEL_RESOURCE_ATTRIBUTES": "org.unit=platform,env=prod"
  },
  "apiKeyHelper": "/usr/local/bin/get-litellm-virtual-key",
  "otelHeadersHelper": "/usr/local/bin/get-otel-ingest-headers",
  "allowManagedPermissionRulesOnly": true,
  "permissions": {
    "disableBypassPermissionsMode": "disable",
    "disableAutoMode": "disable",
    "deny": [
      "Read(**/.env*)",
      "Read(~/.ssh/**)",
      "Bash(git push --force *)"
    ]
  },
  "sandbox": {
    "enabled": true,
    "network": {
      "allowManagedDomainsOnly": true,
      "allowedDomains": ["registry.npmjs.org", "pypi.org"]
    }
  },
  "allowManagedMcpServersOnly": true,
  "allowedMcpServers": [
    { "serverUrl": "https://mcp-jira.internal.corp/*" },
    { "serverCommand": ["python", "/usr/local/bin/internal-db-mcp.py"] }
  ],
  "deniedMcpServers": [
    { "serverUrl": "https://*.untrusted.example.com/*" }
  ],
  "allowManagedHooksOnly": true,
  "strictKnownMarketplaces": [
    { "source": "github", "repo": "corp-eng/claude-plugins" }
  ],
  "extraKnownMarketplaces": {
    "corp-plugins": {
      "source": { "source": "github", "repo": "corp-eng/claude-plugins" },
      "autoUpdate": true
    }
  },
  "enabledPlugins": {
    "corp-sec-hooks@corp-plugins": true
  },
  "disableSideloadFlags": true,
  "syncClaudeAiSkills": false,
  "syncClaudeAiPlugins": false,
  "claudeMd": "Follow corp Python/TS style guides. Never log customer PII."
}
```

**2. CI quality & safety gate before merging a shared Skill/plugin PR into `corp-eng/claude-plugins`:**

```bash
# Runnable CLI validation & eval gate in CI (requires Claude Code >= v2.1.269 for eval)
claude plugin validate --strict ./plugins/corp-deploy-skill
claude plugin eval ./plugins/corp-deploy-skill --threshold 0.90 --output json
```

- **Why this works:** `allowedProviders: ["customEndpoint"]` + `ANTHROPIC_BASE_URL` prevents developers from bypassing LiteLLM; `apiKeyHelper` fetches a per-user short-lived LiteLLM virtual key without storing static keys in config; `allowManagedHooksOnly` + `enabledPlugins` allows only the security team's vetted hooks; `allowedMcpServers` omits `serverName` entries so both URL and stdio checks enforce cryptographic/command identity; OTel exports metrics/events without `OTEL_LOG_USER_PROMPTS` or `OTEL_LOG_TOOL_DETAILS` leaking code; and CI requires both schema validation and positive eval lift (`Δ > 0`) before a Skill/plugin ships to the internal marketplace. (F10) (F15) (F16) (F18) (F20) (F22) (F24) (F27) (F29) (F33)

## Diagram spec

- **Type:** flow
- **Nodes and edges:**
  - `Admin Console (Server-Managed)` / `MDM Plist or HKLM` / `managed-settings.json + .d/*.json` → `Managed Tier Resolver (first-wins default | merge)` → `Effective Policy`
  - `CLI --settings` / `Project .claude/settings.local.json` / `Project .claude/settings.json` / `User ~/.claude/settings.json` → `Merged/Overridden Beneath Managed Tier` (blocked if `allowManaged*Only` locks are `true`)
  - `CLAUDE.md Hierarchy (Managed → User → Project/AGENTS.md → Local)` → `Model Context (Behavioral Guidance)` (separate dashed branch from `Enforced Controls`)
  - `Effective Policy` → branches to:
    1. `Permission & Sandbox Engine (deny → ask → allow; OS sandbox)`
    2. `MCP & Plugin Gate (managed-mcp.json / allowedMcpServers / strictKnownMarketplaces / allowManagedHooksOnly)`
    3. `Inference Route (ANTHROPIC_BASE_URL + apiKeyHelper → LiteLLM / Claude apps gateway → Bedrock/Vertex/Foundry/Anthropic)`
    4. `OTel Pipeline (CLAUDE_CODE_ENABLE_TELEMETRY → Collector via otelHeadersHelper; prompts/tool details redacted by default)`
- **Caption:** Managed settings enforce deterministic client-side policies, MCP/plugin allowlists, gateway routing, and locked OTel destinations, whereas the CLAUDE.md hierarchy supplies non-binding behavioral context.

## Exam lens

*(Editorial inference; scenario patterns, not exam items.)*

1. **CLAUDE.md vs. enforced policy:** An organization puts "Never run `curl` or read `.env` files" in a managed `/etc/claude-code/CLAUDE.md`, but an agent still leaks `.env` under prompt injection. Identify that `CLAUDE.md` is context, not enforcement, and move restrictions to `managed-settings.json` (`permissions.deny`, `sandbox.enabled` + `allowManagedDomainsOnly`, and `allowManagedHooksOnly`). (F30)
2. **Server-managed settings silently skipped or shadowing MDM:** A team configures `strictKnownMarketplaces` in the claude.ai console, but Bedrock/LiteLLM users—or users with a single unrelated key in server-managed settings—don't get the expected MDM/file policy. Diagnose either the `ANTHROPIC_BASE_URL` / `CLAUDE_CODE_USE_BEDROCK` skip rule for server-managed settings or the `"first-wins"` managed-tier shadowing rule. (F5) (F7)
3. **MCP allowlist bypass via `serverName` or un-locked user allowlists:** Security deploys `allowedMcpServers` with `{"serverName": "github"}` or forgets `allowManagedMcpServersOnly: true`. Users either add a malicious server named `github` or add their own URL to `~/.claude/settings.json` allowlist (since lists merge across scopes). Fix by setting `allowManagedMcpServersOnly: true` and specifying `serverUrl` / `serverCommand` entries. (F15) (F16)
4. **Gateway auth & parity pitfalls:** Adding `forceLoginMethod` alongside `apiKeyHelper` / `ANTHROPIC_AUTH_TOKEN` locks out developers at startup; forgetting `DISABLE_TELEMETRY=1` with CMEK + custom `ANTHROPIC_BASE_URL` leaks operational telemetry outside CMEK; or leaving Bedrock/Vertex/Foundry model aliases unpinned causes silent breakage on CLI upgrades. (F21) (F24) (F26)

## Common mistakes

- Putting security rules in `CLAUDE.md` or `.claude/settings.json` alone: `CLAUDE.md` is advisory context, and `.claude/settings.json` allow rules wait for workspace trust and can be widened by local/user settings unless `allowManagedPermissionRulesOnly: true` is set. (F10) (F12) (F30)
- Relying on `serverName` in `allowedMcpServers` or omitting `allowManagedMcpServersOnly: true`: `serverName` is a user-chosen label, and without the lock flag, user/project allowlists merge with the managed allowlist. (F15) (F16)
- Mixing `forceLoginMethod` / `forceLoginOrgUUID` with `ANTHROPIC_AUTH_TOKEN` or `apiKeyHelper` for gateway routing, which blocks sessions at startup. (F24)
- Assuming `managed-mcp.json` or `requiredMinimumVersion` can be pushed via server-managed settings, or forgetting that `ANTHROPIC_BASE_URL` / `CLAUDE_CODE_USE_*` skips server-managed settings fetch entirely. (F7) (F13)
- Enabling `OTEL_LOG_TOOL_DETAILS=1` or `OTEL_LOG_RAW_API_BODIES=1` in general metrics/logging pipelines without SIEM approval, exposing Bash arguments, MCP inputs, and conversation payloads. (F20)
- Assuming Skills uploaded to `/v1/skills` sync to Claude Code or claude.ai, or omitting `version` on production `/v1/skills` requests (which silently tracks latest unreviewed edits). (F31)

## Self-check

1. **Q:** Why does `allowedMcpServers: [{"serverUrl": "https://*.corp.internal/*"}, {"serverName": "github"}]` allow a `stdio` server named `github` while blocking an HTTP server named `github` at `https://api.github.com/mcp`?
   **A:** Claude Code evaluates remote (`HTTP`/`SSE`) and `stdio` servers separately against `allowedMcpServers`: once any `serverUrl` entry exists, remote servers ignore `serverName` and must match a `serverUrl` pattern; because no `serverCommand` entry exists, `stdio` servers still fall back to matching `serverName`. (F16) (F17)
2. **Q:** Your organization sets `CLAUDE_CODE_USE_BEDROCK=1` and `ANTHROPIC_BASE_URL=https://gateway.corp` in MDM, and also configures `strictKnownMarketplaces` in the claude.ai admin console. Which managed settings apply?
   **A:** Only the MDM-delivered settings apply. Server-managed settings from claude.ai are skipped whenever `CLAUDE_CODE_USE_BEDROCK` or a custom `ANTHROPIC_BASE_URL` is set; use MDM/`managed-settings.json` (or `Claude apps gateway`) to deliver `strictKnownMarketplaces` to those machines. (F5) (F7)
3. **Q:** A developer writes a useful Skill in `~/.claude/skills/deploy/` and tests it manually with one prompt. What minimum quality and safety bar is required before promoting it to an organization-wide plugin/Skill?
   **A:** Run a security audit against the risk checklist (checking scripts, network calls, MCP refs, hardcoded secrets, and instruction manipulation) with a reviewer different from the author; validate schema with `claude plugin validate --strict`; and submit a 3–5 query evaluation suite (trigger, non-trigger, edge cases) tested across target models (`claude plugin eval` demonstrating positive `Δ` over the no-plugin baseline). (F31) (F32) (F33)

## Unresolved

- **Granular `managedSourcesBehavior: "merge"` edge cases for `otelHeadersHelper` vs `OTEL_*` unit:** Verified in `server-managed-settings.md` that the telemetry unit (`OTEL_EXPORTER_OTLP_*`, `OTEL_LOG_*`, `OTEL_LOGS_EXPORTER`) follows the highest source that sets any of them, and `otelHeadersHelper` claims that unit while only landing variables if it is the selected source; exact interaction across all three admin tiers when `managedSourcesBehavior: "merge"` is enabled on v2.1.242+ was not tested live.
- **Exact `claude plugin eval` threshold exit codes in older CLI builds:** Verified `claude plugin eval` requires Claude Code v2.1.269+ and git 2.31+ (if git is installed); exact `--output json` schema fields were not inspected in a live CLI execution.
