# Fact-check: Reference Glossary
Checked: 2026-11-19 · Reviewer: OpenAI Codex (GPT-6)
## Summary
Checked 120 citation placements against 35 existing citation entries and their linked sources; added 4 citations. Supported, fixed, and removed claims were not separately tallied at sentence level. Code blocks checked: 0. The exam guide has no separate Glossary objective; the packet's scope is covered by the service-health, API, cost, evaluation, queueing, and formula sections.
## Changes
- SLI families, ratio definition, and window-based SLI — examples were presented as exhaustive or cited beyond the quote's scope → qualified the examples and defined the window ratio (F2, F21).
- Burn rate — omitted the constant-rate condition → added it (F4).
- Stop reasons — generic citation did not establish each behavior, and stream start can have a null reason → checked current pages and clarified the completed response (F36, F39).
- Paused turns — continuation omitted tool configuration and conversation requirements → specified unchanged content, same tools, no following user message, and container reuse when present (F36).
- Refusal and stop sequence — incomplete action → inspect response details and apply a safety policy (F36).
- Cache reads and streaming — citation quoted only cache writes → cited the documented read field and streaming event location (F38).
- Cache hit — a token-level label defined a request-level hit → corrected the label (F38).
- Recall — precision quote alone did not support recall → added the source's recall definition (F37).
- Pass^k — strict decrease is not guaranteed → stated non-increase (F31).
- Output throughput — total output included the first token while the interval started after it → count only tokens generated in the stated interval (F7, F8).
- Retry default — two attempts misstated two retries → corrected the callout (F30).
- Retry guidance — universal requirement exceeded the source's RPC guidance → attributed the recommendation to Google SRE (F29).
- Measurement practice — softened claims about streaming and correlation into recommendations; clarified cost attribution and removed unsupported boilerplate.
- Pricing — checked current model-specific cache read rates and retained the qualified 0.1x example and model-specific warning (F14, F15).
## Remaining concerns
- The quote checker ran from a temporary copy to respect the file scope. Shell network access failed; its successful run used the existing local quote cache. Newly added quotes were also checked on live pages through web fetch.
- Supported, fixed, and removed counts were not recorded per individual sentence. The 120 figure counts citation placements, not distinct claims.
