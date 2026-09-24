# Sampling profiles and evidence policy

This plugin changes only three request fields:

- `temperature`
- `top_p` (`output.topP` in the OpenCode hook)
- `top_k` (`output.topK` in the OpenCode hook)

It does not change reasoning effort, thinking mode, output-token limits, tools, prompts, context compaction, model routing, or provider credentials.

## Family-first policy

The registry prefers one sampling profile per model family. A value supported by several related model cards is applied to the family instead of creating a separate profile for every model ID.

A model-specific profile is retained only when a live route probe demonstrates a capability or rejection that must not be lost. These are safety overrides, not alternative quality claims.

The plugin never changes the thinking mode. It only reads the mode already selected by OpenCode or the provider. When no mode field is present, the request is treated as non-thinking; an explicitly present mode value of `undefined` is treated as thinking. If the selected mode has no preset for a model family, its fields remain unchanged. Use `OPENCODE_SAMPLING_MODE=thinking` or `OPENCODE_SAMPLING_MODE=nonThinking` when the provider does not expose the mode clearly.

Explicit user or agent sampling values always win. The plugin only fills fields that are unset; it never replaces a defined value, even when it equals a provider baseline. `top_k` is never invented.

## Active family profiles

Values were checked on 2026-09-24. `P` means `top_p`; `T` means `temperature`.

| Family | Thinking | Non-thinking | Evidence | Sources |
| --- | --- | --- | --- | --- |
| `gemini-3-pro` | `T=0.35` | `T=0.35` | D | [Lynchmark](https://lynchmark.com/blog/gemini-optimal-temperature), [original plugin](https://github.com/Lyapsus/opencode-optimal-model-temps) |
| `glm-5.x` | `T=1.0` | `T=0.6` | B | [GLM-5.2 guide](https://docs.z.ai/guides/llm/glm-5.2.md) |
| `qwen3.x` | `T=1.0`, `P=0.95` | `T=1.0`, `P=0.95` | B | [Qwen3.8 Max release](https://qwen.ai/blog?id=qwen3.8), [sampling card](https://github.com/xbtlin/ai-berkshire/blob/836f0bf51ffa8f30c22bf730255ab8d64de56b91/reports/%E5%A4%A7%E6%A8%A1%E5%9E%8B%E5%85%A8%E6%99%AF%E5%AF%B9%E6%AF%94-20260906/evidence/Qwen__Qwen3.8-2.4T-A95B__README.md) |
| `deepseek-v4.x` | `T=1.0`, `P=1.0` | `T=1.0`, `P=1.0` | B | [DeepSeek V4 guidance](https://huggingface.co/blog/deepseekv4) |
| `kimi-k2.x` | `T=1.0`, `P=0.95` | `T=0.6`, `P=0.95` | B | [K2.6 guide](https://platform.kimi.ai/docs/guide/kimi-k2-6-quickstart), [K2.7 guide](https://platform.kimi.ai/docs/guide/kimi-k2-7-code-quickstart) |
| `kimi-k3.x` | `T=1.0`, `P=0.95` | `T=0.6`, `P=0.95` | B | [K3 model card](https://github.com/MoonshotAI/Kimi-K3) |
| `MiniMax M2.x` | `T=1.0`, `P=0.95` | `T=1.0`, `P=0.95` (sampling fallback only) | B | [M2 card](https://github.com/MiniMax-AI/MiniMax-M2), [M2.1 card](https://github.com/MiniMax-AI/MiniMax-M2.1), [M2.5 card](https://github.com/MiniMax-AI/MiniMax-M2.5), [M2.7 card](https://github.com/MiniMax-AI/MiniMax-M2.7), [hosted API](https://platform.minimax.io/docs/api-reference/text-anthropic-api) |
| `MiniMax M3.x` | `T=1.0`, `P=0.95` (`enabled`/`adaptive`/`true`/other non-empty values) | `T=1.0`, `P=0.95` (`disabled`/`false`/unset) | B | [M3 card](https://github.com/MiniMax-AI/MiniMax-M3), [hosted API](https://platform.minimax.io/docs/api-reference/text-openai-api) |
| `MiMo V2.x` | `T=1.0`, `P=0.95` | `T=1.0`, `P=0.95` | B | [V2.5 recipe](https://github.com/sgl-project/sglang-jax/blob/11248f5adbd3633a4b21bbc8af01483edd727bfd/docs/cookbook/autoregressive/Xiaomi/MiMo-V2.5-Pro.md), [official V2 Flash guide](https://github.com/XiaomiMiMo/MiMo-V2-Flash/blob/b4eaae40d3728657ff7f0f9397dcce3c9ab3d3b7/README.md) |

## Safety overrides

These overrides are kept because the route probe demonstrated a different capability or rejection:

- `opencode-go` currently rejects disabled thinking for the GLM-5.x aliases, including GLM-5.1, GLM-5.2, and GLM-5.3. The `glm-5-opencode-go` subfamily applies only `T=1.0` in thinking mode.
- `kimi-k2.7-code` on `opencode-go` rejects disabled thinking. The family non-thinking value is not applied on that route.
- `kimi-k3` on `opencode-go` accepted `T=0.6`, `P=0.95` with thinking disabled in a direct probe.
- MiniMax M2.x remains thinking-only in the hosted API. The non-thinking entry only supplies the same sampling values when a route exposes that mode; it does not enable or disable thinking.
- MiniMax M3 treats `thinking.type=enabled`, `thinking.type=adaptive`, `true`, and other non-empty mode values as thinking; `thinking.type=disabled`, `false`, or an unset mode are non-thinking. The plugin never changes the thinking field.

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

```text
explicit user/agent value
-> family profile value
-> provider default
```

The plugin fills only fields that are unset. It does not replace a defined value that happens to equal a provider baseline, and it never invents `top_k`.
