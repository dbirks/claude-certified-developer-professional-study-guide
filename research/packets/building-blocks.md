# Appendix: Choosing between API, Agent SDK, Managed Agents, Claude Code, MCP, Skills, hooks, and plugins

This is a comparison appendix, not an official exam objective. Documentation snapshot: 2026-11-19. Provider capabilities and versions change; check the exact model and endpoint before adopting a design.

## Outline of the appendix

Choose the execution owner and interface → decision table; select integrations and reusable instructions → building blocks; place controls → enforcement table; choose provider → cloud table; turn these into implementation choices → exact details, reasoning and worked example.

## Core facts

### Decision table

| Need | Building block | What it provides and when to choose it |
| --- | --- | --- |
| Direct model access and custom orchestration | Messages API and client SDK | Own the model calls, conversation state and tool execution. Choose a manual loop for approval, custom logging or conditional execution; the SDK beta tool runner automates routine tool calls, state and error wrapping. (F3) |
| Embed an agent in your own Python/TypeScript service | Claude Agent SDK | Claude Code's agent loop, tools and context management exposed as a programmable library; you operate the process and execution environment. (F1) |
| Agent sessions without building and operating the whole harness | Claude Managed Agents | A configurable hosted harness, suited to asynchronous, long-running work. The session can run in an Anthropic-managed cloud sandbox or a self-hosted sandbox. Agent definition, environment and session are distinct concepts. (F2, F4, F5) |
| Developer in a terminal | Claude Code interactive | Terminal interface for iterative development; it uses the same agent capabilities that the Agent SDK exposes. (F1) |
| Scripts and CI | Claude Code headless | `claude -p` executes non-interactively; JSON output provides session metadata for automation. Project discovery is relevant even in noninteractive mode. (F6, F7, F8) |
| GitHub workflow | Claude Code GitHub Actions | Run from GitHub events, including an `@claude` issue or PR comment; select GitHub token permissions and tool access for the workflow's task. (F9) |
| External service or data source | MCP server | A protocol integration exposes external tools, APIs and data; it complements the agent rather than selecting the loop or model. Local stdio runs a local server process; remote HTTP connects over the network. HTTP is recommended for remote servers. (F10, F11, F12) |
| Reusable procedure | Agent Skill | `SKILL.md` instructions can be invoked by Claude when relevant or explicitly as `/skill-name`. A skill supplies task guidance; it does not itself grant access to an external system. (F13, F10) |
| Specialized parallel or isolated-context work | Subagent | A worker with its own context window, prompt, tool access and permissions; return a concise result to the parent. (F15) |
| Lifecycle action or deterministic decision | Hook | Executed at a Claude Code lifecycle event; choose a pre-action event to block and a post-action event for observation or follow-up. (F20, F21) |
| Distribute a capability bundle | Plugin and marketplace | Plugin packages skills, agents, hooks, MCP servers or other components; a marketplace indexes plugins and locations. Installing a plugin and connecting an MCP server are different operations. (F16, F17) |
| Frequently invoked action | Slash command | Built-in commands and user-defined skills share slash invocation; legacy `.claude/commands/` files continue working. Custom commands were merged into skills. (F13, F14) |
| Persistent project conventions | `CLAUDE.md` | Human-authored standing project, personal or organization instructions presented to Claude; use a skill for an on-demand procedure. (F18, F13) |
| Organization-wide policy | Managed settings | Organization-delivered Claude Code settings have higher precedence than local settings for managed keys. They configure controls; the actual enforcement point depends on the specific control. (F22, F19, F23) |

A managed agent agent-definition holds the model, system prompt, tools, MCP servers and skills; create an environment for where the session runs, then associate a session with the configuration. A self-hosted sandbox is an available deployment option, so “managed” does not imply every sandbox is Anthropic-hosted. (F2, F5)

### Where does this control actually get enforced?

| Mechanism | Enforcement point | Practical limit |
| --- | --- | --- |
| Prompt, `CLAUDE.md`, skill | Model receives instructions in context; Claude decides how to act. (F13, F18) | [INFERENCE] Guidance is not an independent access boundary; do not rely on wording alone to enforce a prohibition. |
| `PreToolUse` hook | Claude Code invokes the hook before the tool call; exit 2 blocks that call. (F20) | `PostToolUse` occurs after execution and cannot prevent that completed call. Hooks must actually be loaded: `--bare` skips a user-settings hook. (F21, F8) |
| Permission rule | Claude Code's tool permission layer allows, asks or denies according to matching rules; deny blocks specified tools. (F19) | [INFERENCE] Scope rules to the tools and actions you intend to govern; a policy about one path or tool is not proof of protection against every other access route. |
| Managed setting | Claude Code resolves an organization-set key over lower-precedence settings. (F22) | [INFERENCE] Precedence secures the configuration value, but protection depends on what that value controls and the deployment of the managed setting. |
| Sandbox | OS enforces the boundary on the running sandboxed Bash process, even when the command string looks allowed. (F23) | [INFERENCE] Check OS, filesystem and network policy, exceptions and which processes are sandboxed; do not describe this as an unrestricted machine-wide boundary. |

### Provider selection and portability

| Route | Operator, credentials, request and IDs | Feature considerations |
| --- | --- | --- |
| First-party Claude API | Anthropic; API key, workload identity federation or App Attest. Use Claude API model IDs. (F24) | Direct platform baseline. [INFERENCE] Check feature-specific availability and account eligibility rather than assuming every model has every capability. |
| Claude Platform on AWS | Anthropic operates; AWS SigV4 or API key, IAM and AWS Marketplace billing. Claude API surface and IDs; distinguish it from AWS-operated Bedrock. (F25, F27) | Typically same-day API features, subject to stated limitations; Bedrock follows AWS release schedule. (F26) |
| Amazon Bedrock | AWS-operated inference, accessed through Bedrock credentials and endpoint. Bedrock mantle exposes Messages; runtime uses Bedrock InvokeModel/Converse and provider-specific model identifiers. (F25, F26) | Bedrock release schedule differs; validate endpoint, region, model, beta and tool support. (F26) |
| Google Cloud, Anthropic managed | Anthropic-operated Claude API reached via Google project; Google OAuth and SDK Application Default Credentials; workspace configuration required. (F28, F29) | Claude API-style integration, but feature availability remains offering-specific. [INFERENCE] Check the source's supported and unsupported lists before migrating. (F28) |
| Google Cloud, Google managed (Vertex/Agent Platform) | Google-operated; `AnthropicVertex`, ADC and Agent Platform endpoint. Raw calls put model in URL. Some IDs include date suffixes, e.g. `claude-haiku-4-5@20251001`. (F30, F31, F35) | Agent Skills, MCP connector and programmatic tool calling are listed as unsupported. This refers to server-side platform features, not a claim that an independently hosted client cannot implement analogous behavior. (F32) |
| Microsoft Foundry | API key or Microsoft Entra ID; use the Foundry deployment name, which can differ from the underlying model ID. (F33, F34) | [INFERENCE] Check deployment hosting option, region, model and feature support separately before assuming parity. |

## Exact API / config details

- `claude -p "Summarize this project" --output-format json` is non-interactive and emits a JSON result with session metadata. `--output-format stream-json` is available; inspect the current CLI documentation for streaming flags. (F6, F7)
- `--bare` changes discovery: it skips a hook in `~/.claude/settings.json` and a project MCP server in `.mcp.json`, but still reads settings and permission rules. This matters if a safety check depends on the hook. (F8)
- Remote MCP JSON with `url` requires a `type`; absent `type`, Claude Code interprets it as stdio and rejects a URL-only entry. The recommended remote transport is HTTP. (F11, F12)
- `SKILL.md` is the skill instruction file; `/skill-name` invokes a skill; `.claude/commands/` remains supported. (F13, F14)
- `PreToolUse` exit status `2` blocks a pending call; `PostToolUse` exit `2` cannot prevent an action already performed. Event semantics differ, so do not generalize exit behavior to every hook. (F20, F21)
- Google-managed raw prediction uses the model in the endpoint, and the SDK client is `AnthropicVertex`; dated model identifiers can differ from first-party identifiers. (F30, F31, F35)
- Foundry model argument is the deployment name; deployment names can be customized. (F34)

## Practitioner reasoning

- [INFERENCE] Start by choosing who operates the loop and runtime. A reusable skill or MCP server does not answer whether your application owns retries, approval, execution environment and session lifecycle.
- [INFERENCE] Choose manual tool orchestration when the business transaction requires explicit approval before side effects or audit logging at each step. A tool runner reduces loop code but does not remove responsibility for external service permissions, idempotency or result validation. (F3)
- [INFERENCE] A remote MCP server centralizes integrations but adds a network and authentication boundary; local stdio keeps the process local to the host but still inherits the process's credentials and filesystem access. Use least-privilege credentials and check the server's trustworthiness. (F10, F11, F12)
- [INFERENCE] A subagent's separate context reduces noise but requires a clear task, necessary inputs and a checkable return. Separate context alone does not provide OS or credential isolation. (F15, F23)
- [INFERENCE] Provider migration is a contract migration: map authentication, endpoint shape, identifiers, deployment and feature support, then test the actual path before switching production traffic. In particular, a cloud billing relationship does not identify which company operates inference. (F25, F28, F30, F34)

## Worked example

A team needs an automated PR review of a Python service and a human-approved deployment. Use the GitHub Action for the review trigger, a project skill for review criteria, and a read-only MCP integration for the issue tracker. Use a `PreToolUse` policy check and permission rules for operations the agent can perform; enforce filesystem and network boundaries in the execution environment. Put deployment authorization in the deployment system, and keep the actual deploy outside the review workflow. This is an architectural illustration, not a claim that a prompt alone enforces approval. (F9, F10, F13, F19, F20, F23)

Example shell invocation, runnable with a configured current Claude Code installation and authentication; no specific SDK version is assumed:

```sh
claude -p "Summarize this project" --output-format json
```

The command's JSON includes result and session metadata. [INFERENCE] CI should check the process exit status and validate the returned content before using it downstream; it should also account for repository-loaded components and any chosen `--bare` mode. (F6, F7, F8)

## Diagram spec

Flow: developer/application → choose direct Messages loop, Agent SDK process, Managed Agents session, or Claude Code; each may connect to tools; MCP → local stdio or remote HTTP; policy → permission/hook and execution environment → OS sandbox. Caption: choose execution ownership first, integrations second, and enforce restrictions at the appropriate layer. (F1, F2, F3, F10, F11, F20, F23)

## Exam lens

Editorial inferences, not real exam items:

- A scenario requiring a fully customized approval sequence points toward a manual loop; one requiring an embedded agent with built-in tools points toward Agent SDK. (F1, F3)
- A long-running asynchronous task and managed infrastructure point toward Managed Agents; do not confuse its self-hosted environment option with a requirement to build a loop from scratch. (F2, F4)
- Separate behavioral guidance from controls capable of blocking tool execution or enforcing OS boundaries. (F18, F20, F23)
- When migrating clouds, distinguish who operates inference, credentials, model/deployment identifiers and feature support. (F25, F28, F30, F34)

## Common mistakes

- Assuming a post-tool hook prevents an operation that already ran, or assuming a pre-tool hook runs under `--bare`. (F8, F20, F21)
- Treating a plugin marketplace, an installed plugin and a live MCP server as the same thing. (F10, F16, F17)
- Treating Claude Platform on AWS as Bedrock, or both Google Cloud offerings as the same backend. (F25, F28, F30)
- Reusing a first-party model identifier as a Foundry deployment name without checking the deployment, or overlooking dated Vertex identifiers. (F34, F35)

## Self-check

1. Where should a hook block an unsafe tool call? **Before execution, with `PreToolUse`; exit 2 blocks the call.** (F20)
2. Does a skill automatically give Claude database access? **No. It supplies instructions; access requires an integration and authorization.** (F10, F13)
3. Is an Anthropic-managed AWS platform the same inference operator as Bedrock? **No. Anthropic operates the former and AWS operates the latter.** (F25)

## Unresolved

- Detailed feature matrices, availability by region, current IDs and deprecation dates are moving targets; consult the provider and feature documentation for the exact deployment. The Google-managed feature exclusions cited here should not be generalized to every Google Cloud offering. (F32, F35)
- The exact latest Bedrock runtime model ID and beta combinations are intentionally not hard-coded here; verify them in the relevant AWS/Anthropic endpoint documentation before implementation.
- This appendix does not establish which sandbox settings or hooks are deployed in a particular organization; inspect the actual environment and test a denied action.
