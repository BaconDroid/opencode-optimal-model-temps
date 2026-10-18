# opencode-optimal-model-temps

OpenCode plugin for conservative model sampling profiles.

The plugin hooks `chat.params` and manages only:

- `temperature`
- `top_p` (`topP` in the hook output)
- `top_k` (`topK` in the hook output)

It does not change reasoning effort, thinking mode, output-token limits, tools, prompts, context compaction, or model routing.

Thinking and non-thinking models can have separate presets. The plugin reads the mode selected by OpenCode; it never enables or disables thinking itself. When no mode field is present, the request is treated as non-thinking; an explicitly present `undefined` value is treated as thinking. If the selected mode has no preset, the fields remain unchanged. `OPENCODE_SAMPLING_MODE=thinking` or `OPENCODE_SAMPLING_MODE=nonThinking` can be used as an explicit override.

## Installation

Add the plugin to `~/.config/opencode/opencode.json`:

```json
{
  "plugin": [
    "opencode-optimal-model-temps"
  ]
}
```

## Profiles

The active profiles are family-first: GLM-5.x, Qwen3.x, DeepSeek V4.x, Kimi K2.x/K3.x, MiniMax M2.x/M3.x, MiMo V2.x, Grok 4.x, `grok-build`, Tencent Hunyuan Hy3, Tencent Hunyuan Hy4, and Meituan LongCat 2.x. Route-specific subfamilies are retained only when a provider constraint or probe requires them. The original Gemini 3 Pro rule remains available for compatibility.

Model-specific entries are retained only as safety overrides when a live OpenCode Go probe rejects the family value or when a model has a documented thinking-only constraint. The registry deliberately registers no profile for hosted Claude, StepFun, or Meta Llama models, because Claude rejects non-default sampling while StepFun's hosted API and Meta Llama publish no usable recommendation.

See [docs/sampling-profiles.md](docs/sampling-profiles.md) for the complete table, source URLs, evidence levels, route-specific limitations, and the policy for adding new values.

## Precedence

Profile selection is two-tier: a model-specific rule (`scope: "model"`) always wins, and family rules are a fallback used only when no model-specific rule matches — independent of entry order in the registry. The plugin then preserves explicit sampling values and only fills fields that are unset. A defined value is never replaced, even when it equals a provider baseline. The plugin does not add fields without an applicable profile value.

For the legacy Gemini profile, this environment variable remains supported:

- `OPENCODE_GEMINI3_TEMPERATURE`: target temperature, default `0.35`.

## Development

```sh
npm test
node --check src/index.js
node --check src/profiles.js
npm pack --dry-run
```
