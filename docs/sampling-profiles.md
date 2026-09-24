# Sampling profiles and evidence policy

This plugin changes only three request fields:

- `temperature`
- `top_p` (`output.topP` in the OpenCode hook)
- `top_k` (`output.topK` in the OpenCode hook)

It does not change reasoning effort, thinking mode, output-token limits, tools, prompts, context compaction, model routing, or provider credentials.

## Family-first policy

The registry prefers one sampling profile per model family. A value supported by several related model cards is applied to the family instead of creating a separate profile for every model ID.

A model-specific profile is retained only when a live route probe demonstrates a capability or rejection that must not be lost. These are safety overrides, not alternative quality claims.

The plugin never changes the thinking mode. It only reads the mode already selected by OpenCode or the provider. For a two-mode profile, an unknown mode is a no-op. Use `OPENCODE_SAMPLING_MODE=thinking` or `OPENCODE_SAMPLING_MODE=nonThinking` when the provider does not expose the mode clearly.

Explicit user or agent sampling values always win. The plugin only fills an unset field or replaces a documented provider baseline. `top_k` is never invented.

## Active family profiles

Values were checked on 2026-09-24. `P` means `top_p`; `T` means `temperature`.

| Family | Thinking | Non-thinking | Evidence | Sources |
| --- | --- | --- | --- | --- |
| `gemini-3-pro` | `T=0.35` | `T=0.35` | D | [Lynchmark](https://lynchmark.com/blog/gemini-optimal-temperature), [original plugin](https://github.com/Lyapsus/opencode-optimal-model-temps) |
| `glm-5.x` | `T=1.0` | `T=0.6` | B | [GLM-5.2 guide](https://docs.z.ai/guides/llm/glm-5.2.md) |
| `qwen3.7-max`, `qwen3.8-max` | `T=1.0`, `P=0.95` | `T=1.0`, `P=0.95` | B | [Qwen3.8 Max release](https://qwen.ai/blog?id=qwen3.8), [sampling card](https://github.com/xbtlin/ai-berkshire/blob/836f0bf51ffa8f30c22bf730255ab8d64de56b91/reports/%E5%A4%A7%E6%A8%A1%E5%9E%8B%E5%85%A8%E6%99%AF%E5%AF%B9%E6%AF%94-20260906/evidence/Qwen__Qwen3.8-2.4T-A95B__README.md) |
| `deepseek-v4` | `T=1.0`, `P=1.0` | `T=1.0`, `P=1.0` | B | [DeepSeek V4 guidance](https://huggingface.co/blog/deepseekv4) |
| Kimi K2.6/K2.7/K3 | `T=1.0`, `P=0.95` | `T=0.6`, `P=0.95` | B | [K2.6 guide](https://platform.kimi.ai/docs/guide/kimi-k2-6-quickstart), [K3 model card](https://github.com/MoonshotAI/Kimi-K3), [K2.7 guide](https://platform.kimi.ai/docs/guide/kimi-k2-7-code-quickstart) |
| MiniMax M2/M3 | `T=1.0`, `P=0.95` | `T=0.1`, `P=0.95` | B | [M2 card](https://github.com/MiniMax-AI/MiniMax-M2), [M3 card](https://github.com/MiniMax-AI/MiniMax-M3), [hosted API](https://platform.minimax.io/docs/api-reference/text-anthropic-api) |
| MiMo V2.5 | `T=1.0`, `P=0.95` | `T=0.7`, `P=0.95` (agentic/tool-use proxy) | B | [validated V2.5 recipe](https://github.com/sgl-project/sglang-jax/blob/11248f5adbd3633a4b21bbc8af01483edd727bfd/docs/cookbook/autoregressive/Xiaomi/MiMo-V2.5-Pro.md) |
| MiMo V2 Flash | `T=0.3`, `P=0.95` (agentic proxy) | `T=0.8`, `P=0.95` (math/writing/web proxy) | B | [official MiMo-V2-Flash guide](https://github.com/XiaomiMiMo/MiMo-V2-Flash/blob/b4eaae40d3728657ff7f0f9397dcce3c9ab3d3b7/README.md) |

## Safety overrides

These overrides are kept because the route probe demonstrated a different capability or rejection:

- `glm-5.3` is thinking-only on every tested route. Non-thinking requests are not filled.
- `opencode-go` currently rejects disabled thinking for the GLM-5.x aliases, including GLM-5.1 and GLM-5.2. The Go override applies only `T=1.0` in thinking mode.
- `kimi-k2.7-code` on `opencode-go` rejects disabled thinking. The family non-thinking value is not applied on that route.
- `kimi-k3` on `opencode-go` accepted `T=0.6`, `P=0.95` with thinking disabled in a direct probe.
- MiniMax M2.5 accepted both family values on Go. M2.7 returned temporary 503 responses, and the exact M2 model was unavailable during probing; the family values are nevertheless applied by user policy.
- MiniMax M3 accepts `thinking.type=adaptive` or `disabled` on Go. It rejects `thinking.type=enabled`; the plugin never changes this field.

## Evidence and research limits

A benchmark setting is not automatically an optimal temperature. Public comparisons were found for GLM-5.2 and a task-specific MiniMax M3 triage benchmark, but no task-independent sweep was found for the exact hosted Kimi, MiniMax, Qwen, DeepSeek, MiMo, or GLM families.

The MiniMax M3 `0.1` value is a user-selected family extrapolation, not a universally validated optimum. MiMo's official values are task-based: agentic/tool-use and non-agentic categories are mapped to the available mode slots rather than claimed as native API-mode guarantees.

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
-> known provider baseline replacement
-> family profile value
-> provider default
```

The OpenCode hook cannot always distinguish an explicit value equal to a provider default from that default itself. Baselines are used only when explicitly documented or inherited from the original plugin behavior.
