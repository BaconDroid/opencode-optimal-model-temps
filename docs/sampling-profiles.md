# Sampling profiles and evidence policy

This plugin changes only three request fields:

- `temperature`
- `top_p` (`output.topP` in the OpenCode hook)
- `top_k` (`output.topK` in the OpenCode hook)

It does not change reasoning effort, thinking mode, output-token limits, tools, prompts, context compaction, model routing, or provider credentials.

## Family-first policy

The registry prefers one sampling profile per model family. A value supported by several related model cards is applied to the family instead of creating a separate profile for every model ID.

A model-specific profile is retained only when a live route probe demonstrates a capability or rejection that must not be lost. These are safety overrides, not alternative quality claims.

Model ids may be vendor-namespaced by a gateway (for example `commandcode/z-ai/glm-5.3-flash`). A profile matches both the full id and the vendor-stripped basename, so the same family rule applies across providers.

The plugin never changes the thinking mode. It only reads the mode already selected by OpenCode or the provider. When no mode field is present, the request is treated as non-thinking; an explicitly present mode value of `undefined` is treated as thinking. If the selected mode has no preset for a model family, its fields remain unchanged. Use `OPENCODE_SAMPLING_MODE=thinking` or `OPENCODE_SAMPLING_MODE=nonThinking` when the provider does not expose the mode clearly.

Explicit user or agent sampling values always win. The plugin only fills fields that are unset; it never replaces a defined value, even when it equals a provider baseline. `top_k` is never invented.

## Active family profiles

Values were initially checked on 2026-09-24 and re-checked against corroborating sources on 2026-10-17. `P` means `top_p`; `T` means `temperature`.

| Family | Thinking | Non-thinking | Evidence | Sources |
| --- | --- | --- | --- | --- |
| `gemini-3-pro` | `T=0.35` | `T=0.35` | D | [Lynchmark](https://lynchmark.com/blog/gemini-optimal-temperature), [original plugin](https://github.com/Lyapsus/opencode-optimal-model-temps) |
| `glm-5.x` | `T=1.0` | `T=0.6` | B | [GLM-5.2 guide](https://docs.z.ai/guides/llm/glm-5.2.md) |
| `qwen3.5.x` | `T=0.6`, `P=0.95` | `T=0.7`, `P=0.8` | B | [Qwen3.5 card](https://huggingface.co/Qwen/Qwen3.5-397B-A17B) |
| `qwen3.8-max` | `T=1.0`, `P=0.95` | `T=1.0`, `P=0.95` (thinking-only fallback) | B | [Qwen3.8-2.4T card](https://huggingface.co/Qwen/Qwen3.8-2.4T-A95B), [archived card](https://github.com/xbtlin/ai-berkshire/blob/836f0bf51ffa8f30c22bf730255ab8d64de56b91/reports/%E5%A4%A7%E6%A8%A1%E5%9E%8B%E5%85%A8%E6%99%AF%E5%AF%B9%E6%AF%94-20260906/evidence/Qwen__Qwen3.8-2.4T-A95B__README.md) |
| `qwen3.x` | `T=1.0`, `P=0.95` | `T=0.7`, `P=0.8` | B | [Qwen3.6 card](https://huggingface.co/Qwen/Qwen3.6-27B), [Qwen3.8-27B card](https://huggingface.co/Qwen/Qwen3.8-27B), [Qwen3.8-Flash-Next card](https://huggingface.co/Qwen/Qwen3.8-Flash-Next-FP8) |
| `deepseek-v4.x` | `T=1.0`, `P=1.0` | `T=1.0`, `P=1.0` | A | [DeepSeek V4 guidance](https://huggingface.co/blog/deepseekv4), [NVIDIA NIM](https://docs.nvidia.com/nim/large-language-models/latest/get-started/advanced/get-started-deepseek-v4-pro-0813.html) |
| `kimi-k2.x` | `T=1.0`, `P=0.95` | `T=0.6`, `P=0.95` | A | [K2.6 guide](https://platform.kimi.ai/docs/guide/kimi-k2-6-quickstart), [K2.7 guide](https://platform.kimi.ai/docs/guide/kimi-k2-7-code-quickstart), [Dell Enterprise Hub](https://dell.huggingface.co/models/moonshotai/Kimi-K2.6) |
| `kimi-k3.x` | `T=1.0`, `P=0.95` | `T=0.6`, `P=0.95` | B | [K3 model card](https://github.com/MoonshotAI/Kimi-K3) |
| `MiniMax M2.x` | `T=1.0`, `P=0.95` | `T=1.0`, `P=0.95` (sampling fallback only) | B | [M2 card](https://github.com/MiniMax-AI/MiniMax-M2), [M2.1 card](https://github.com/MiniMax-AI/MiniMax-M2.1), [M2.5 card](https://github.com/MiniMax-AI/MiniMax-M2.5), [M2.7 card](https://github.com/MiniMax-AI/MiniMax-M2.7), [hosted API](https://platform.minimax.io/docs/api-reference/text-anthropic-api) |
| `MiniMax M3.x` | `T=1.0`, `P=0.95` (`enabled`/`adaptive`/`true`/other non-empty values) | `T=1.0`, `P=0.95` (`disabled`/`false`/unset) | B | [M3 card](https://github.com/MiniMax-AI/MiniMax-M3), [hosted API](https://platform.minimax.io/docs/api-reference/text-openai-api) |
| `MiMo V2.x` | `T=1.0`, `P=0.95` | `T=1.0`, `P=0.95` | B | [V2.5 recipe](https://github.com/sgl-project/sglang-jax/blob/11248f5adbd3633a4b21bbc8af01483edd727bfd/docs/cookbook/autoregressive/Xiaomi/MiMo-V2.5-Pro.md), [official V2 Flash guide](https://github.com/XiaomiMiMo/MiMo-V2-Flash/blob/b4eaae40d3728657ff7f0f9397dcce3c9ab3d3b7/README.md) |
| `Grok 4.x` | `T=0.7`, `P=0.95` | `T=0.7`, `P=0.95` | B | [xAI best practices](https://docs.x.ai/developers/model-capabilities/text/best-practices), [xAI Grok Build settings](https://docs.x.ai/build/settings.md) |
| `grok-build` | `T=0.7`, `P=0.95` | `T=0.7`, `P=0.95` | B | [xAI best practices](https://docs.x.ai/developers/model-capabilities/text/best-practices) |
| `Hy3` | `T=0.9`, `P=1.0` | `T=0.9`, `P=1.0` | A | [Hy3](https://github.com/Tencent-Hunyuan/Hy3), [vLLM Recipes](https://recipes.vllm.ai/tencent/Hy3) |
| `Hy4` | `T=0.9`, `P=1.0` | `T=0.9`, `P=1.0` | A | [Hy4 preview](https://github.com/Tencent-Hunyuan/Hy4-preview), [vLLM Recipes](https://recipes.vllm.ai/tencent/Hy4-preview) |
| `LongCat 2.x` | `P=0.95` | `P=0.95` | B | [LongCat API model params](https://longcat.ai/platform/docs/api/model-params) |

## Safety overrides

These overrides are kept because the route probe demonstrated a different capability or rejection:

- `opencode-go` currently rejects disabled thinking for the GLM-5.x aliases, including GLM-5.1, GLM-5.2, and GLM-5.3. The `glm-5-opencode-go` subfamily applies only `T=1.0` in thinking mode.
- `kimi-k2.7-code` uses a fixed `T=1.0`, `P=0.95` and errors if thinking is disabled (Moonshot docs), so the model-specific rule is thinking-only on every provider and its non-thinking slot is never filled.
- `kimi-k3` on `opencode-go` accepted `T=0.6`, `P=0.95` with thinking disabled in a direct probe.
- MiniMax M2.x remains thinking-only in the hosted API. The non-thinking entry only supplies the same sampling values when a route exposes that mode; it does not enable or disable thinking.
- MiniMax M3 treats `thinking.type=enabled`, `thinking.type=adaptive`, `true`, and other non-empty mode values as thinking; `thinking.type=disabled`, `false`, or an unset mode are non-thinking. The plugin never changes the thinking field.

## Independent corroboration

Values were re-checked against sources outside the vendor that first published them. No value has an independent *measurement* (third-party sweep); the corroboration below repeats a vendor recommendation.

| Family | Corroborating source | Kind | Result |
| --- | --- | --- | --- |
| `Hy3` / `Hy4` | [vLLM Recipes](https://recipes.vllm.ai/tencent/Hy3): `temperature=0.9, top_p=1.0` | independent infra recipe | agrees → `A` |
| `kimi-k2.x` | [Dell Enterprise Hub](https://dell.huggingface.co/models/moonshotai/Kimi-K2.6): thinking `1.0`, instant `0.6`, top_p `0.95` | independent distributor | agrees → `A` |
| `deepseek-v4.x` | [NVIDIA NIM](https://docs.nvidia.com/nim/large-language-models/latest/get-started/advanced/get-started-deepseek-v4-pro-0813.html): defaults `1.0`/`1.0` | independent infra docs | agrees (workload caveat) → `A` |
| `qwen3.x` | [Qwen3.5](https://huggingface.co/Qwen/Qwen3.5-397B-A17B), [Qwen3.6](https://huggingface.co/Qwen/Qwen3.6-27B), [Qwen3.8-27B](https://huggingface.co/Qwen/Qwen3.8-27B), [Qwen3.8-Flash-Next](https://huggingface.co/Qwen/Qwen3.8-Flash-Next-FP8) | same vendor (official cards) | mode split confirmed; no independent source |
| `Grok 4.x` / `grok-build` | none found | — | xAI-only, stays `B` |
| `LongCat 2.x` | Meituan sibling card only | vendor-family | stays `B` |
| `glm-5.x`, `minimax-m2.x`/`m3.x`, `mimo-v2.x`, `kimi-k3` | none found (relays only) | — | stay `B` |

## Provider restrictions and unresolved evidence

These are deliberate non-entries or restrictions, recorded so the registry is not extended by guesswork:

- **Claude (Haiku 5.5 and newer)** rejects non-default sampling. `temperature` must be `1`, `top_p` must be `0.99` (its default), any `top_k` errors, and a request carrying both `temperature` and `top_p` errors even at their defaults. No Claude profile is registered, so the plugin leaves all three fields untouched and never fills them. See [Claude thinking](https://platform.claude.com/docs/en/build-with-claude/thinking) and the [Haiku 5.5 migration guide](https://platform.claude.com/docs/en/models/haiku-5-5/migration-guide).
- **StepFun**: the hosted cookbook page was unreachable during this audit and the hosted API docs give no sampling recommendation (the Responses example only echoes `temperature 1.0`, `top_p 1.0`). The open-weight card for `Step-5-Preview` states `temperature=1.0, top_p=0.95, top_k=0`, which conflicts with the hosted example. No profile is registered until the hosted recommendation is confirmed.
- **Meta Llama**: the official Llama downloads page publishes no recommended `temperature`, `top_p`, or `top_k`. No profile is registered.
- **Qwen3.x**: resolved by splitting the family. Official Qwen cards give a consistent mode split — thinking `1.0/0.95` on Qwen3.6/3.8, thinking `0.6/0.95` on Qwen3.5, and non-thinking `0.7/0.8` on every hybrid card. `qwen3.8-max` is thinking-only and reuses the same values for both slots. The primary `qwen.ai` blog is client-rendered and was not re-read; all values come from the official Hugging Face cards listed in the table. No independent (non-Qwen) source was verified.

Benchmark-only or conflicting evidence that is intentionally not applied:

- **Kimi K3**: the model card reports `top_p=0.95` for single-step tasks and `top_p=1.0` for agentic tasks at `temperature=1.0`. These are benchmark conditions rather than a recommendation, so the family keeps `0.95` and records the agentic alternative.
- **MiMo V2 Flash** recommends `temperature=0.8` (math, writing, web-dev) and `0.3` (agentic) with `top_p=0.95`, while the MiMo V2.5-Pro recipe uses `temperature=1.0`. The family keeps `1.0`; the V2-Flash task-specific values are not separate mode profiles.
- **Grok 4.x / grok-build** values (`T=0.7`, `P=0.95`) are an official xAI recommendation, not a measured sweep; no independent source restates them, and xAI does not publish a separate reasoning-mode value, so both modes share the values.
- **DeepSeek V4.x**: official guidance is `temperature=1.0, top_p=1.0` for all modes, but the independent NVIDIA NIM documentation adds that "for agentic workloads, DeepSeek recommends top_p=0.95". Coding agents are agentic; the family keeps `1.0` until that conflict is resolved.
- **Qwen3.x**: the official cards apply a mode split (thinking `1.0/0.95` on 3.6/3.8, `0.6/0.95` on 3.5; non-thinking `0.7/0.8`), which the plugin now follows. Two alternatives are deliberately not applied: the Qwen3.6 `0.6` precise-coding tier (the hook cannot know the task type) and the hosted QwenCloud `0.6` thinking default for `qwen3.8-flash` (conflicts with the open-card `1.0`; the open-card value is used).
- **Gemini 3 Pro (legacy)**: the retained `T=0.35` comes from a single community benchmark and has no independent support; Google's official guidance for Gemini 3 is to keep `temperature` at its default `1.0`. The rule is retained only for backward compatibility and stays at level `D`.

## Evidence and research limits

A benchmark setting is not automatically an optimal temperature. Public comparisons were found for GLM-5.2 and a task-specific MiniMax M3 triage benchmark, but no task-independent sweep was found for the exact hosted Kimi, MiniMax, Qwen, DeepSeek, MiMo, or GLM families.

MiniMax M2.x has no hosted guarantee that non-thinking is available. The family nevertheless reuses `T=1.0`, `P=0.95` for the non-thinking slot so an absent or explicitly non-thinking mode receives the same sampling fallback without changing the provider's mode. The hosted API compatibility documentation lists a `0.9` top_p default for M2.x while the official model cards recommend `0.95`; the profile uses `0.95` only when top_p is unset and preserves other values. The global mode classifier treats unset values as non-thinking, explicit `undefined` as thinking, and other non-empty values as thinking; provider acceptance of the thinking field remains route-specific. MiMo V2.x uses `T=1.0`, `P=0.95` in both modes by family policy; task-specific values from the source guides are not separate mode profiles.

## Verification workflow

Before adding or changing a family profile:

1. Find an exact official model card, API reference, or repository.
2. Check whether the value is a default, recommendation, benchmark condition, or measured optimum.
3. Prefer a family value supported by multiple related IDs.
4. Run a minimal live route probe when a route-specific rejection or capability is suspected.
5. Keep a model-specific override only when the probe demonstrates that the family value would be invalid.
6. Record the source, date, values, and limitations in `src/profiles.js` and this document.

A route-specific probe can lower confidence or add a safety override, but it does not prove that a different route has the same limitation.

## Precedence

Profile selection, then value application.

Profile selection is two-tier:

```text
model-specific profile (scope: "model")
-> family profile (fallback)
-> provider default
```

A model- or route-specific rule always wins over a family rule for the same request, regardless of entry order in the registry; family entries are a fallback used only when no model-specific rule matches. Within one tier, the first matching entry wins.

Value application is then:

```text
explicit user/agent value
-> selected profile value
-> provider default
```

The plugin fills only fields that are unset. It does not replace a defined value that happens to equal a provider baseline, and it never invents `top_k`.
