# 7.3 Identity, Secrets, and Audit at Scale

Applying enterprise identity and secrets practice to production Claude deployments, including agent identity, workload identity federation replacing static API keys, credential and secrets management, least-privilege tool permissioning, and audit logging of security-relevant agent actions.

## Scope map

- Agent identity → Core facts; Exact API / config details; Practitioner reasoning; Worked example; Exam lens.
- Workload identity federation replacing static API keys → Core facts; Exact API / config details; Practitioner reasoning; Worked example; Diagram spec; Exam lens.
- Credential and secrets management → Core facts; Exact API / config details; Practitioner reasoning; Common mistakes.
- Least-privilege tool permissioning → Core facts; Exact API / config details; Practitioner reasoning; Worked example; Exam lens.
- Audit logging of security-relevant agent actions → Core facts; Exact API / config details; Practitioner reasoning; Diagram spec; Common mistakes.

## Core facts

- Claude API authentication includes static API keys, Workload Identity Federation (WIF), and App Attest. WIF is the workload path for platforms already issuing identity tokens; Claude API keys and WIF have the same access to API endpoints. (F1)
- Claude API key types include personal keys, service-account keys, and legacy workspace keys. A workspace-scoped key is restricted to that workspace; an unscoped key requires an `anthropic-workspace-id` header on each request. (F2) (F3)
- The Admin API accepts an Admin API key, `org:admin` OAuth bearer token, or personal/service-account key that is not scoped to one workspace. Service-account and WIF resource management endpoints require `org:admin` OAuth specifically; workspace-scoped keys cannot call the Admin API. (F4)
- WIF binds an upstream OIDC issuer and claim-matching rule to a named Anthropic service account. The SDK exchanges an upstream signed JWT for a short-lived `sk-ant-oat01-...` Anthropic token and refreshes it before expiry. Supported upstream identity sources include AWS, Google Cloud, Entra ID, GitHub Actions, Kubernetes, SPIFFE, and Okta. (F5) (F6)
- Anthropic service accounts are non-human principals. A service account is implicitly in the default workspace; add it to each additional workspace it should access. A federation rule's workspace must match a workspace membership, and usage follows that workspace's limits and attribution. (F7)
- WIF rules specify an OAuth scope and token lifetime. The default scope is `workspace:developer`; lifetime is 60–86,400 seconds (default 3,600). Rules are chosen by ID; Anthropic does not search rules implicitly. The wizard currently prefills a 600-second lifetime, so distinguish wizard default from API default. (F8)
- The direct WIF environment flow activates with `ANTHROPIC_FEDERATION_RULE_ID`, `ANTHROPIC_ORGANIZATION_ID`, and either `ANTHROPIC_IDENTITY_TOKEN_FILE` or `ANTHROPIC_IDENTITY_TOKEN`. The SDK credential order places constructor credentials and `ANTHROPIC_API_KEY` / `ANTHROPIC_AUTH_TOKEN` before federation, so a stale API key can silently defeat migration. (F9) (F10)
- WIF tokens have a refresh schedule: advisory refresh 120 seconds before expiry, mandatory refresh 30 seconds before expiry. The SDK rereads the identity token file for each exchange. JWTs with `jti` are single-use by default; reusing a token causes exchange failure. (F11)
- Claude Code's provider authentication is distinct from Claude API WIF: Bedrock uses the AWS SDK credential chain; Google Cloud Agent Platform can use ADC, a service-account key file, or environment credentials; Microsoft Foundry supports API key, Entra SDK credential-chain authentication, or a supplied Entra bearer token. (F12) (F14) (F15)
- Claude Code's `apiKeyHelper` supports dynamic API/gateway credentials and sends helper output as both `X-Api-Key` and `Authorization: Bearer`. It caches output for five minutes by default and refreshes after qualifying 401/403 errors; a configurable TTL is available. (F16) (F17)
- MCP authorization on HTTP transports follows the MCP OAuth authorization model: an MCP server is a resource server and authorization occurs on behalf of resource owners. For stdio, the MCP spec directs implementations to retrieve credentials from the environment instead. (F18)
- MCP servers must validate that access tokens are issued for their own audience. A server must not accept or forward unrelated client tokens; when calling an upstream resource it uses a separate token issued for that resource. (F19) (F20)
- The Messages API MCP connector accepts an `authorization_token` for a remote MCP server, while the API consumer must obtain and refresh the OAuth token before making the Claude API call. This is not the same as handing Claude a refresh token or configuring a delegated OAuth flow inside the Messages API. (F21)
- Claude Code permissions use fine-grained rules and managed policy. Allow only the tool and argument patterns needed; explicit `ask` and `deny` rules can cover higher-risk tools, paths, commands, and MCP servers. Use managed settings for organization-enforced policy and project settings when sharing team rules. (F22)
- Claude Code's OTel `claude_code.tool_decision` event records accept/reject permission outcomes, including tool name and `tool_use_id`. The `tool_result` event records execution, not rejected calls. MCP server/tool names and arguments require `OTEL_LOG_TOOL_DETAILS=1`. (F23) (F25)
- OTel events can join prompts and actions by `prompt.id`, tool decision/result pairs by `tool_use_id`, and sessions with `session.id`. For direct API-key and cloud-provider Claude Code sessions, the OTel identity is otherwise only `user.id` and `session.id`; attach the actual human or workload identity through `OTEL_RESOURCE_ATTRIBUTES`. (F24)
- The Compliance API Activity Feed is an organization audit source. It distinguishes actors such as `api_actor` (which includes `api_key_id`) and `admin_api_key_actor`; it does not provide complete auditing of model/tool execution. Admin API keys can read only the Activity Feed, while Compliance Access Keys cover additional data according to scopes. (F26) (F27) (F28)
- The Compliance API excludes API prompt/response content and Claude Code usage authenticated with a Claude Console API key, run through a cloud provider, or run in a Claude Code cloud session. Use Claude Code OTel or application-level audit records for those paths. (F29)
- Anthropic recommends storing API keys in a secrets manager, rotating periodically, and disabling or deleting suspected leaked keys. Compliance Access Key scopes are immutable; rotation is create replacement, update consumer, verify, then delete old key. (F30) (F31)

## Exact API / config details

### Claude API identity and WIF

- **API key transport:** direct HTTP sends `Authorization: Bearer <key>`; `ANTHROPIC_API_KEY` is read automatically by the SDK. A key that is not workspace-scoped requires `anthropic-workspace-id` per request; missing it returns HTTP 400 `invalid_request_error`, while an inaccessible/unknown workspace returns 404 `not_found_error`. (F2) (F3)
- **Admin API:** Admin key starts `sk-ant-admin...` and uses `x-api-key`; `org:admin` uses `Authorization: Bearer`; unscoped personal/service-account keys use `x-api-key`. No workspace-scoped key. The service-account, federation issuer, and federation rule endpoints require `org:admin`. (F4)
- **WIF exchange:** `POST /v1/oauth/token`, with `grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer"`, `assertion` (IdP JWT), `federation_rule_id` (`fdrl_...`), and `organization_id` (UUID). `service_account_id` is optional in the request; the rule determines the account, and any supplied ID must match it. (F6)
- **Environment variables:** `ANTHROPIC_FEDERATION_RULE_ID`, `ANTHROPIC_ORGANIZATION_ID`, plus `ANTHROPIC_IDENTITY_TOKEN_FILE` or `ANTHROPIC_IDENTITY_TOKEN`; optionally `ANTHROPIC_SERVICE_ACCOUNT_ID` and `ANTHROPIC_WORKSPACE_ID`. Prefer file-mounted projected tokens where available. Remove `ANTHROPIC_API_KEY` and `ANTHROPIC_AUTH_TOKEN` during migration; both outrank environment WIF. (F9) (F10)
- **Refresh semantics:** a minted token expires at the lesser of the rule lifetime and twice the upstream JWT's remaining lifetime, never below 60 seconds. Advisory refresh is expiry −120s; mandatory refresh is expiry −30s. With `jti` replay checking, fetch a fresh upstream JWT for every exchange. (F11)
- **Tenant isolation:** map workload classes to distinct service accounts and narrowly scoped rules; assign only required workspaces. Use rule claims/subject constraints (for example environment, cluster namespace, CI repository) and smallest usable OAuth scope. The default `workspace:developer` equals workspace API-key access, not organization-admin access. (F7) (F8)

### Claude Code, cloud credentials, and permissions

- **Claude Code credential helper:** in settings JSON, `{"apiKeyHelper":"/path/to/credential-command"}`. The command's stdout is the credential, sent in both `X-Api-Key` and bearer authorization headers. Cache TTL is `CLAUDE_CODE_API_KEY_HELPER_TTL_MS` in milliseconds (5 minutes by default); helper refresh occurs after the default TTL and on Anthropic API 401/403. Claude Code reloads helper settings as settings files change. (F16) (F17)
- **Bedrock:** `CLAUDE_CODE_USE_BEDROCK=1` with the default AWS SDK credential chain. In production prefer role-backed runtime credentials (instance/task role or federation) over IAM user access keys. `awsAuthRefresh` runs a command such as `aws sso login --profile myprofile` only after the current credentials fail an STS check. `awsCredentialExport` is the alternate pattern when the helper prints credentials rather than updating `~/.aws`. (F12) (F13)
- **Google Cloud Agent Platform (formerly Vertex AI):** Claude Code provider auth can use ADC, service-account key file, or environment credentials. The wizard saves configuration in the user settings `env` block. These are Google provider credentials; separate Claude API WIF can federate a Google-issued JWT into a Claude API service account. (F14) (F5)
- **Microsoft Foundry:** set `CLAUDE_CODE_USE_FOUNDRY=1`. Entra ID default credential chain requires `ANTHROPIC_FOUNDRY_API_KEY` and `ANTHROPIC_FOUNDRY_AUTH_TOKEN` unset. A supplied Entra token uses `ANTHROPIC_FOUNDRY_AUTH_TOKEN`, sent as `Authorization: Bearer`; it takes precedence over API key and default credential chain. (F15)
- **Permission policy:** `permissions.allow`, `permissions.ask`, and `permissions.deny`; examples include `Bash(npm run lint)`, `Read(./.env)`, `mcp__server__tool`, and path-specific rules. `allowedTools` / CLI `--allowedTools` is a session-level convenience; policy is better centrally enforced with managed settings and the explicit deny/ask rules. Always inspect exact current permission syntax before copying patterns. (F22)

### MCP authorization and audit

- **MCP HTTP authorization:** send bearer tokens in the `Authorization` header on every HTTP request; do not put access tokens in query strings. MCP requires resource audience binding and validation. A server that calls upstream APIs must obtain a separate upstream token; do not forward the token the MCP client presented. (F18) (F19) (F20)
- **Messages API remote MCP:** MCP server objects include `type: "url"`, `url`, `name`, and optional `authorization_token`; callers own acquisition and refresh. Treat the token as a sensitive request credential and do not put it in prompts or reusable agent instructions. (F21)
- **Claude Code OTel audit:** set `CLAUDE_CODE_ENABLE_TELEMETRY=1` with `OTEL_LOGS_EXPORTER=otlp` (plus collector endpoint/headers). `claude_code.tool_decision` has permission outcome; `claude_code.tool_result` has completed calls. `OTEL_LOG_TOOL_DETAILS=1` reveals MCP server/tool and arguments, and therefore increases content sensitivity. (F23) (F25)
- **Action attribution:** set `OTEL_RESOURCE_ATTRIBUTES="enduser.id=<stable-user-or-workload-id>,tenant.id=<tenant>"` per launch or managed environment for API-key/provider sessions; use `session.id`, `prompt.id`, `tool_use_id`, event timestamp/sequence, and app request ID to join lifecycle records. `user.id` alone is installation-scoped and not a durable human identity. (F24)
- **Compliance API Activity Feed:** `GET /v1/compliance/activities` uses an `x-api-key` credential and `anthropic-version`. A read-only audit collector needs `read:compliance_activities`; Admin API keys are Activity Feed-only. Enterprise Compliance Access Keys may cover transcript/content endpoints and should be separated from routine SIEM collection. Compliance Access Key scopes cannot be edited after creation. (F26) (F28) (F31)

## Practitioner reasoning

- **[INFERENCE] Choose identity by execution boundary.** For a backend calling Claude API directly, use Claude WIF to exchange the workload's cloud-issued OIDC identity for an Anthropic service-account token. For Claude Code routed through Bedrock, Google Cloud Agent Platform, or Foundry, use that provider's IAM/ADC/Entra chain. The former is Anthropic-issued workload auth; the latter authorizes a cloud-provider inference API. Avoid treating provider-native IAM as automatically equivalent to Claude API WIF. (F5) (F12) (F14) (F15)
- **[INFERENCE] Give each agent class a principal.** Production support, CI review, and data migration agents should not share one service account if their permissions or audit owners differ. Use a separate service account per trust boundary and workspace, separate rules per deployment environment, narrow subject/claim matching, and `workspace:developer` only where the workload needs that endpoint family. Do not use `org:admin` for inference calls. (F7) (F8)
- **[INFERENCE] Treat identity token and access token as separate credentials.** WIF removes the long-lived Anthropic key but still depends on the upstream issuer, token retrieval, JWKS reachability, correct audience/subject conditions, and refreshing before the issuer token is replayed or expires. Monitor exchange errors, time-to-expiry, and rule IDs; roll out with a parallel rule, validate the credential source, then revoke the old key. (F5) (F10) (F11)
- **[INFERENCE] Enforce least privilege in layers.** Tool declarations define what the model can request; Claude Code permission rules decide which requested actions proceed; MCP server authorization checks the human/delegated token and resource audience; backend authorization still checks tenant/object ownership. An allowlisted tool is not authorization to every record that tool can access.
- **[INFERENCE] Keep secrets out of model-visible text.** Do not put API keys, bearer tokens, OAuth refresh tokens, or private key material in prompts, `CLAUDE.md`, tool descriptions, examples, committed settings, or logs. A `CLAUDE.md` is contextual instruction content and may be sent into the model context; inject secret values at runtime through a secret manager, protected environment, credential helper, or provider identity chain. Redact logs and avoid `OTEL_LOG_TOOL_DETAILS=1` unless the collector is approved for those arguments. (F16) (F25) (F30)
- **[INFERENCE] Separate audit goals and identities.** Use Claude Code OTel for prompt-to-tool event reconstruction and permission outcomes; the Compliance Feed is for organization activity and admin/API-key actor events. For server-side Messages API tools, emit application audit records with authenticated principal, tenant, session/request ID, tool name, authorization result, and resource IDs; neither compliance activity nor model transcript alone proves downstream business authorization.
- **[INFERENCE] Isolate tenants at authorization boundaries.** Bind trusted caller identity to tenant scope server-side; derive the tenant from verified identity and server state rather than model-supplied arguments. Use separate service accounts/workspaces where isolation or metering boundaries require them. In MCP, validate `aud`, issuer, expiry, scopes, and user/tenant claims, then perform per-user delegated authorization for each tool call.
- **[INFERENCE] Rotation should be an overlap deployment.** Issue replacement credentials, distribute them through secret injection, confirm successful auth and attribution, then revoke old credentials. Keep static API key overlap short; for WIF, stage issuer/rule/service account first, remove higher-precedence keys, confirm WIF wins, and finally delete old keys. For leaked credentials, revoke immediately and investigate their use, accepting that immediate revocation can interrupt workloads. (F10) (F30) (F31)

## Worked example

**Scenario:** A multitenant order-support agent runs in Kubernetes. It calls Claude API, then invokes an `orders` MCP server under the signed-in user's delegated access. A separate Code reviewer runs only in the staging workspace. The production agent has its own service account and WIF rule with subject constrained to `system:serviceaccount:prod:orders-agent`, audience set to the production token exchange audience, and membership only in the production workspace. The staging reviewer has a different subject/rule/service account/workspace. Neither workload receives a Claude API key.

The production pod gets a projected OIDC token at `/var/run/secrets/anthropic.com/token`. Its environment has the WIF rule ID, Anthropic organization UUID, service-account ID, and workspace ID. A module-level Python client uses SDK environment resolution and refreshing:

```python
# Runnable with a current anthropic Python SDK that supports WIF,
# the WIF environment variables above, and a projected OIDC token file.
from anthropic import Anthropic

client = Anthropic()  # resolves WIF credentials; no ANTHROPIC_API_KEY
message = client.messages.create(
    model="claude-opus-5-5",
    max_tokens=600,
    messages=[{"role": "user", "content": "Check order status."}],
)
```

The API caller separately fetches a per-user MCP access token and places it in the MCP connector's `authorization_token`. The MCP server validates that token's issuer, expiry, scopes, and audience for the orders server, then checks the user's authorization to the requested order and tenant. It never forwards that token to an upstream order database; any downstream call uses a separate service credential or delegated token issued for that resource. (F6) (F7) (F9) (F19) (F20) (F21)

Audit fields join across the application and Claude Code plane: `tenant.id`, stable `enduser.id`, Anthropic service account/rule, workspace ID, `session.id`, `prompt.id`, request ID, MCP server/tool, `tool_use_id`, decision/result, resource ID, and authorization outcome. OTel records tool decisions/results; the application writes the authoritative tenant authorization decision. Do not capture the bearer token or full tool payload unless a narrowly scoped incident workflow requires it. (F23) (F24) (F25)

## Diagram spec

- **Type:** sequence
- **Actors:** Kubernetes workload / projected OIDC issuer; Anthropic WIF token endpoint; Claude Messages API; agent application; user's OAuth authorization server; MCP resource server; SIEM.
- **Messages:** workload obtains OIDC JWT → exchanges JWT plus `fdrl_...` at `POST /v1/oauth/token` → receives short-lived Anthropic service-account token → calls Messages API. Separately, agent obtains a user-delegated MCP token → calls the MCP server with audience-bound bearer token → server validates user, tenant, audience, scopes and resource permission → returns tool result. Claude Code emits tool decision/result OTel events and application emits authorization audit record to SIEM; Compliance API Activity Feed is ingested separately for organization events.
- **Caption:** Separate the workload's Anthropic service identity from each user's delegated MCP identity, and preserve joins from model request through tool decision and business authorization.

## Exam lens

*(Editorial inference; scenario patterns, not exam items.)*

1. A team says it enabled WIF but CloudTrail/Anthropic requests still use its API key: identify credential precedence and remove the lingering `ANTHROPIC_API_KEY` before judging the WIF rule.
2. A shared agent's MCP server accepts a Claude API bearer token and forwards it to a downstream resource: reject token passthrough; validate MCP audience and obtain an appropriate downstream token.
3. A tool is permitted by a broad `allowedTools` configuration but touches another tenant's record: separate model/tool permission from per-user, per-tenant authorization in the MCP server.
4. A security team expects the Compliance API to show Claude Code tool calls made through Bedrock or a Claude Console key: route these events through Claude Code OTel and application logs; Compliance API has documented coverage gaps.

## Common mistakes

- Leaving a static `ANTHROPIC_API_KEY` set during WIF migration and assuming federation is active. (F10)
- Using workspace-scoped API keys or service accounts outside their workspace membership, or expecting a workspace key to call the Admin API. (F3) (F4) (F7)
- Confusing direct Claude API WIF with Bedrock IAM, Google ADC, or Foundry Entra provider authentication. (F5) (F12) (F14) (F15)
- Reusing a `jti`-bearing upstream JWT across token exchanges, or allowing projected-token rotation to lag the SDK refresh schedule. (F11)
- Putting secrets in prompts, `CLAUDE.md`, repository settings, or verbose OTel events. `OTEL_LOG_TOOL_DETAILS=1` can reveal MCP arguments and shell commands. (F25) [INFERENCE]
- Treating MCP OAuth as authentication alone: audience, issuer, scopes, user delegation, and object-level tenant authorization must all be checked. (F18) (F19) [INFERENCE]
- Assuming the Compliance Feed is an execution trace or complete record of API/Claude Code tool activity. (F26) (F29)
- Rotating by revoking the active key before updating and verifying its replacement, or giving a routine SIEM integration transcript-wide Compliance Access Key scopes. (F28) (F31)

## Self-check

1. **Why can WIF be configured yet unused?** A constructor credential or `ANTHROPIC_API_KEY` / `ANTHROPIC_AUTH_TOKEN` wins earlier in SDK credential precedence; unset it and confirm the WIF source. (F10)
2. **What proves that a Claude Code tool was denied, and how do you join it to execution?** `claude_code.tool_decision` records accept/reject; match `tool_use_id` to tool result and `prompt.id`/`session.id` for context. (F23) (F24)
3. **Can an MCP server pass its received bearer token to a downstream service?** No. It validates the token for itself and obtains a distinct token intended for the downstream resource. (F19) (F20)

## Unresolved

- The reviewed sources document the Messages API MCP connector as caller-managed OAuth token acquisition/refresh, but do not document a general Claude API OIDC federation mechanism for each end-user's per-request delegated MCP authorization. Keep user delegation in the application/MCP OAuth layer unless Anthropic documents a dedicated feature.
- Claude Code OTel provides local action events; the Compliance API has explicit exclusions for Claude Code API-key/provider/cloud sessions. The reviewed docs do not establish a single built-in immutable session-to-business-action audit trail spanning the Claude API, custom application, and arbitrary MCP servers. Correlation IDs and application audit events must bridge these systems.
- No official instruction located that specifically says “do not put secrets in prompts or CLAUDE.md.” This packet treats that as standard engineering practice, marked `[INFERENCE]`, supported operationally by runtime credential delivery and keeping detailed tool capture gated.
