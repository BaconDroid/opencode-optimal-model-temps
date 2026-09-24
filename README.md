# opencode-optimal-model-temps

OpenCode plugin for conservative model sampling profiles.

The plugin hooks `chat.params` and manages only:

- `temperature`
- `top_p` (`topP` in the hook output)
- `top_k` (`topK` in the hook output)

It does not change reasoning effort, thinking mode, output-token limits, tools, prompts, context compaction, or model routing.

Thinking and non-thinking models can have separate presets. The plugin reads the mode selected by OpenCode; it never enables or disables thinking itself. If a two-mode model has no detectable mode, the plugin leaves the request unchanged. `OPENCODE_SAMPLING_MODE=thinking` or `OPENCODE_SAMPLING_MODE=nonThinking` can be used as an explicit override.

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

The active profiles are family-first: GLM-5.x, Qwen3 Max, DeepSeek V4, Kimi K2.6/K2.7/K3, MiniMax M2/M3, MiMo V2.5, and MiMo V2 Flash. The original Gemini 3 Pro rule remains available for compatibility.

Model-specific entries are retained only as safety overrides when a live OpenCode Go probe rejects the family value or when a model has a documented thinking-only constraint. The registry deliberately does not auto-apply values for hosted Grok models; their evidence remains conflicting or fixed-benchmark-only.

See [docs/sampling-profiles.md](docs/sampling-profiles.md) for the complete table, source URLs, evidence levels, route-specific limitations, and the policy for adding new values.

## Precedence

The plugin preserves explicit sampling values. It only fills an unset field or replaces a documented provider baseline. A missing or unsupported field is never invented.

For the legacy Gemini profile, these environment variables remain supported:

- `OPENCODE_GEMINI3_TEMPERATURE`: target temperature, default `0.35`.
- `OPENCODE_GEMINI3_BASELINE`: recognized baseline, default `1`.

## Development

```sh
npm test
node --check src/index.js
node --check src/profiles.js
npm pack --dry-run
```
