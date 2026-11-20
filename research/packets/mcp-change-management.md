# 2.3 Production MCP and Change Management

Applying production MCP operation and change-management practice to MCP server deployments, model version migrations, and prompt updates, including remote MCP deployment and authentication, tool and schema versioning, migration testing against breaking behavior changes, platform-specific configuration parity and gateway/routing architectures, prompt versioning, and progressive rollout with rollback.

## Scope map

- Remote MCP deployment and authentication → Core facts; Exact API / config details; Practitioner reasoning.
- Tool and schema versioning → Core facts; Practitioner reasoning; Worked example.
- Migration testing against breaking behavior changes → Core facts; Practitioner reasoning; Worked example.
- Platform-specific configuration parity and gateway/routing architectures → Core facts; Exact API / config details; Diagram spec.
- Prompt versioning → Practitioner reasoning; Worked example.
- Progressive rollout with rollback → Practitioner reasoning; Worked example; Exam lens.

## Core facts

- The published MCP revision is `2026-07-28`; its stateless era declares protocol version and capabilities per request rather than using the old initialization exchange. `2025-11-25` remains a relevant handshake-era compatibility target, not an alias for the new wire behavior. (F1) (F2) (F3)
- For the older protocol, the client proposes a supported version in `initialize`, the server echoes it or offers another supported version, and the client should disconnect if it cannot support the response. Capabilities are negotiated as well. (F3) (F4)
- Standard transport choices include local stdio and Streamable HTTP. Streamable HTTP replaces the old HTTP+SSE transport; Claude Code labels the legacy SSE transport deprecated and recommends HTTP. Deprecation of the old transport does not mean SSE event streams within Streamable HTTP are deprecated. (F5) (F6)
- The 2025 HTTP authorization profile uses OAuth 2.1 authorization servers; protected-resource metadata under RFC 9728 identifies authorization servers, and resource indicators under RFC 8707 specify the intended resource. Authorization is optional at the protocol level; where the profile is implemented, follow its requirements. For stdio, the profile recommends environment-supplied credentials instead. (F36) (F7) (F8) (F33)
- Validate that the bearer token is intended for this MCP resource. Do not forward that token to a downstream API; obtain a separate appropriate downstream credential. Invalid or expired tokens receive HTTP 401 under the 2025 profile. (F9) (F10) (F35)
- In the 2025 lifecycle, a server advertising `listChanged` should notify when its tools change. In 2026, notifications reach clients through an opted-in `subscriptions/listen` stream; upgrading a server without upgrading subscription handling can leave cached tool lists stale. (F11) (F12)
- The Messages API MCP connector calls remote HTTP servers, supports Streamable HTTP and legacy SSE, and cannot directly connect to local stdio. It supports MCP tool calls, not the entire MCP feature set. Its exchanged definitions and results are not covered by zero-data-retention arrangements. (F13) (F38) (F17)
- Connector migration is itself a breaking configuration change: the deprecated `mcp-client-2025-04-04` beta is replaced by `mcp-client-2025-11-20`, and tool configuration moves from the server entry into an `mcp_toolset` in `tools`. The newer `mcp-client-2026-09-15` beta supports pinning a returned tool list on supported platforms. (F14) (F15) (F16)
- On the Claude API, some pre-4.6 dateless names are convenience aliases resolving to the latest dated snapshot. From 4.6 onward, dateless IDs are fixed snapshots. Pinned weights still do not promise perfectly identical observable behavior because serving infrastructure can change. (F20) (F21) (F22)
- Migrate before retirement: requests to retired models fail. Anthropic-operated and partner-operated platforms can have different lifecycle dates; an apparently healthy secondary route may already be retired or lack the desired capability. (F23) (F24)
- A specific migration hazard: Fable 5.2 treats a changed tool list as an edit to the conversation prefix; editing `system`, `tools`, or earlier messages while returning thinking blocks can produce HTTP 400. Fable 5.1 cannot read Fable 5.2 thinking blocks, so rollback has a conversation-state consequence. (F25) (F26) (F31)
- Claude Code scope matters operationally: local scope is private and project-specific, project scope is shared in project-root `.mcp.json`, and user scope is private across projects. The effective server can therefore differ between developers or CI even when the repository is identical. (F18) (F19) (F37)

## Exact API / config details

- The connector beta header is `anthropic-beta: mcp-client-2025-11-20`; `mcp-client-2026-09-15` adds listing pinning where supported. Each `mcp_servers` entry supplies `type: "url"`, `url`, `name`, and optionally `authorization_token`; match its name in a `tools` entry with `type: "mcp_toolset"` and `mcp_server_name`. URL must start with `https://`. The Python example below uses the documented `betas` option. (F13) (F14) (F15) (F16) (F39)
- Toolset controls are `default_config.enabled` and a `configs` object keyed by tool name; a deny-by-default set with explicit enabled names prevents newly published tools from automatically joining the allowlist. [INFERENCE] This is application exposure control, not a substitute for server-side authorization. (F15)
- For the new listing beta, preserve the returned `mcp_tool_listing` block in assistant history or copy the recorded `name`, `description`, and `input_schema` entries to the toolset's `tools` list, as documented for the applicable platform. Pinning a description does not preserve the server implementation. (F16)
- `claude mcp add --transport http shared-server --scope project https://example.com/mcp` writes a project-scoped configuration; `--scope user` selects user scope; omit scope for local. Review project `.mcp.json` without committing bearer secrets. (F18) (F19) (F37)
- A 2025 tool-list event is JSON-RPC method `notifications/tools/list_changed`; the corresponding capability is `listChanged`. In the 2026 era, listen using the subscription stream supported by the client; re-list tools after change events and invalidate dependent caches. [INFERENCE] Test missed events, reconnect, and catalog reconciliation, not merely the happy path. (F11) (F12)
- For Fable 5.2, the Claude API ID is `claude-fable-5-2`; Bedrock `bedrock-runtime` uses profile IDs such as `global.anthropic.claude-fable-5-2` or `us.anthropic.claude-fable-5-2`. Google managed and other platforms use the model ID stated in its migration guide; Foundry calls use the actual deployment name. Foundry's Anthropic-hosted fast mode uses a `claude-fable-5-2-fast` deployment and omits `speed`. (F28) (F29) (F32)
- Claude Code routes via `ANTHROPIC_BASE_URL`. Configure the gateway's authentication and upstream provider separately; changing the base URL alone does not establish identical model names, capabilities, or entitlement. (F30) [INFERENCE]
- Failure vocabulary that matters: HTTP `401` for invalid/expired MCP token; Fable 5.2 prefix mismatch produces HTTP `400`. Do not conflate either with a malformed tool argument or an ordinary model-quality regression. (F35) (F26)

## Practitioner reasoning

- [INFERENCE] Inventory the complete deployable contract: protocol revision and transport, endpoint path, issuer and canonical resource/audience, auth scopes, tool names, descriptions and input/output schemas, server implementation and dependencies, client/SDK, model ID, prompt and route configuration. Version these separately, then record their combination in a release manifest. Protocol version does not version your business tools.
- [INFERENCE] Treat removing or renaming a tool, requiring a formerly optional argument, narrowing an enum, changing units, or changing result meaning as potentially breaking. Even an optional input or an added tool can change model selection and behavior. Retain a v1 tool or endpoint alongside v2, compare real calls and results, migrate client allowlists, and retire v1 only after traffic drains. Send change notifications where supported; a notification is a cache invalidation signal, not a compatibility promise. (F11) (F12)
- [INFERENCE] When moving the public MCP hostname or path, treat the canonical resource identity as an auth migration. Publish correct metadata through the proxy, request a new resource-bound token, validate issuer and audience at each replica, and test expired, wrong-audience and insufficient-scope cases. Do not repair a 401 by blindly forwarding a token intended for a different backend. (F7) (F8) (F9) (F10) (F35)
- [INFERENCE] Compare the old and new complete request configurations with replayable, privacy-appropriate golden cases and representative multi-turn trajectories. Measure task success, tool selection and argument validity, groundedness, refusal/stop outcomes, schema parsing, retries, p95 latency and cost. Include adversarial, boundary and long-context cases, and validate actual side effects in an isolated or simulated system. Separately test request acceptance, auth, event delivery, multi-turn continuation and session rollback. Model replacement is not merely an ID substitution: forced `tool_choice` accepted by Opus 5 is rejected by Fable 5.2. (F27)
- [INFERENCE] Preserve immutable prompt templates, variables, system text and example sets in version control; assign a content hash or release ID and log it alongside model, tool schema digest, platform, gateway route and eval dataset revision. Keep secrets and raw sensitive content out of telemetry. A prompt edit is a release and can invalidate preserved thinking-prefix assumptions; start new conversations on the new manifest or follow the model-specific documented migration procedure. Claude consumer app system-prompt updates are separate from API prompts. (F26) (F34)
- [INFERENCE] Roll out one change at a time where practical: offline gate, shadow or sandbox replay without duplicate side effects, then a small sticky cohort, expanding only when quality, correctness, latency, errors and spend meet predefined thresholds. Assign stable conversations rather than individual turns to a cohort. Maintain a known-good model, prompt, schema, endpoint and routing bundle; rehearse rollback, including credentials, dependencies and data compatibility. (F25) (F31)
- [INFERENCE] A gateway centralizes authentication, quotas, logging, model mapping and routing but adds a dependency and potential semantic translation. Maintain a tested matrix per upstream: actual deployment ID, region, identity, quota, beta headers, tool and streaming support, data handling, retirement date, request/response shape, and required SDK adapter. Run the same contract and behavioral suite against each path; route only when the requested combination is supported. Gateway routing does not make vendor APIs or retention guarantees interchangeable. (F24) (F28) (F29) (F30) (F32)

## Worked example

[INFERENCE] A support agent migrates its MCP `lookup_order` server and model in stages. Its 10,000 daily conversations currently use model A, prompt `p17`, server `orders-v1`, and the old schema. A candidate adds optional `region` and introduces a separate `refund_quote_v2` with changed currency units. The release manifest records the exact versions, tool-list hash, OAuth resource and platform deployment. The server retains v1; the candidate toolset explicitly enables only the approved tools. The team compares 500 representative cases including malformed inputs, multi-turn tool use, bad audience, expiry, and no-result behavior. Regression thresholds are set before inspection: no unauthorized side effects, no contract failures, and at most 1 percentage point decline in labeled task success. These are illustrative targets, not Anthropic requirements.

Replay is sandboxed because both real and candidate calls could otherwise create duplicate actions. Route 1% of **new conversations** to the candidate, then 10%, 50%, and 100% after each observation window passes quality and operational gates. Compare each cohort by customer/task type; a low global error rate can hide a failing tenant. If 400s or task failures breach a gate, send new conversations back to the prior manifest; keep existing candidate conversations on their compatible route or explicitly restart them. Test the Fable 5.2-to-5.1 case because the old model cannot consume newer thinking blocks. Restore the old server, allowlist and prompt together if any depend on the changed schema. (F26) (F31)

The following is **illustrative Python pseudocode**, based on the documented Anthropic Python SDK beta interface; it requires an SDK release supporting the stated beta, a real model entitlement, an existing resource-bound token, and a deployed server. It does not run as written because the endpoint and token are placeholders. (F13) (F14) (F15) (F39)

```python
import anthropic

client = anthropic.Anthropic()
response = client.beta.messages.create(
    model="claude-fable-5-2",
    max_tokens=1024,
    messages=[{"role": "user", "content": "Find order 123."}],
    mcp_servers=[{
        "type": "url", "name": "orders",
        "url": "https://orders.example.com/mcp",
        "authorization_token": "RESOURCE_BOUND_ACCESS_TOKEN",
    }],
    tools=[{
        "type": "mcp_toolset", "mcp_server_name": "orders",
        "default_config": {"enabled": False},
        "configs": {"lookup_order": {"enabled": True}},
    }],
    betas=["mcp-client-2025-11-20"],
)
```

## Diagram spec

Type: flow. Nodes: developer/CI → Claude Code or application → authenticated LLM gateway → platform adapter and model deployment; application or Messages connector → authenticated remote MCP endpoint → independent downstream API. Edges carry release-manifest route/model/prompt/schema IDs; MCP edge carries resource-bound token; downstream edge uses its own credential. A feedback edge sends cohort quality and errors to the rollout controller, which changes routing or restores the previous manifest. Caption: A model gateway and an MCP server are distinct routing and authorization boundaries. [INFERENCE] (F9) (F10) (F30)

## Exam lens

- [Editorial inference] A server upgrade adds a tool and a long conversation starts failing with 400: inspect model-specific prefix rules and pinned tool definitions before changing OAuth settings. (F16) (F25) (F26)
- [Editorial inference] A fallback runs on Foundry or Bedrock but rejects the same request: inspect deployment IDs, provider-specific parameters, capabilities, beta headers and lifecycle before retrying. (F24) (F28) (F29) (F32)
- [Editorial inference] A migration changes the MCP URL and the old token stops working: verify resource metadata and token audience instead of forwarding a downstream token. (F7) (F8) (F9) (F10)
- [Editorial inference] A canary improves average quality but breaks one schema or customer cohort: stop expansion and roll back the compatible release bundle; aggregate performance alone is insufficient.

## Common mistakes

- Assuming every dateless model ID is a moving alias, or that model pinning freezes the serving stack. (F20) (F21) (F22)
- Treating legacy HTTP+SSE deprecation as a prohibition on all SSE streaming. (F5) (F6)
- Assuming the connector can directly reach stdio, consume all MCP features, or satisfy ZDR. (F13) (F17) (F38)
- Assuming the 2025 `initialize` negotiation and unsolicited-notification behavior apply unchanged to the 2026 protocol. (F2) (F3) (F12)
- Reverting only the model name while leaving a new prompt, tool schema, thinking history or provider deployment in place. [INFERENCE] (F25) (F26) (F31)

## Self-check

1. Why can a model-pinned conversation still fail after an MCP deploy? A changed tool list can violate Fable 5.2 thinking-prefix checks; freeze the listing and investigate the server contract. (F16) (F25) (F26)
2. Does `claude-sonnet-4-6` act like the older `claude-sonnet-4-5` alias? No: 4.6-generation dateless IDs are pinned; earlier API convenience aliases can resolve to the latest dated snapshot. (F20) (F21)
3. What must change when an MCP server moves to a new canonical resource? [INFERENCE] Test metadata, audience-specific token issuance and validation, client configuration and downstream credentials, then roll out and monitor together. (F7) (F8) (F9) (F10)

## Unresolved

- The connector documentation's platform availability widget renders platform-specific beta variants ambiguously in text extraction. Verify the 2026 listing beta and feature support directly for the exact platform and hosting option before use; do not assume Bedrock or Google-managed Vertex supports the Claude API connector. (F16)
- The repository currently lacks `scripts/verify-quotes.mjs`; citation quotes were checked by re-opening primary pages and matching rendered text, with JSON-formatted YAML parsed locally. The MCP protocol version supported by the Anthropic-hosted connector itself was not explicitly documented in the pages reviewed; verify actual interoperability against the target deployment.
