# opencode-optimal-model-temps

OpenCode plugin for conservative model sampling profiles.

The plugin hooks the request parameters (`chat.params` on OpenCode V1, the session `context` hook on OpenCode V2) and
manages only:

- `temperature`
- `top_p` (`topP` in the request options)
- `top_k` (`topK` in the request options)

It does not change reasoning effort, thinking mode, output-token limits, tools, prompts, context compaction, or model
routing.

Thinking and non-thinking models can have separate presets. The plugin reads the mode selected by OpenCode; it never enables or disables thinking itself. When no mode field is present, the request is treated as non-thinking; an explicitly present `undefined` value is treated as thinking. If the selected mode has no preset, the fields remain unchanged. `OPENCODE_SAMPLING_MODE=thinking` or `OPENCODE_SAMPLING_MODE=nonThinking` can be used as an explicit override.

## Installation

Add the plugin to `~/.config/opencode/opencode.json` (OpenCode V2):

```json
{
  "plugins": [
    "opencode-optimal-model-temps"
  ]
}
```

Local checkouts use a path entry (a directory containing a root `index.js`):

```json
{
  "plugins": [
    "/path/to/opencode-optimal-model-temps"
  ]
}
```

OpenCode V1 (1.18.29 and newer) still loads the same package through the legacy entry point:

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

Hosted gateways can namespace model ids by vendor (for example `commandcode/z-ai/glm-5.3-flash`). A profile matches both the full id and the vendor-stripped basename, so the same family rule applies across providers.

See [docs/sampling-profiles.md](docs/sampling-profiles.md) for the complete table, source URLs, evidence levels, route-specific limitations, and the policy for adding new values.

## Precedence

Profile selection is two-tier: a model-specific rule (`scope: "model"`) always wins, and family rules are a fallback used only when no model-specific rule matches — independent of entry order in the registry. The plugin then preserves explicit sampling values and only fills fields that are unset. A defined value is never replaced, even when it equals a provider baseline. The plugin does not add fields without an applicable profile value.

On OpenCode V2 the `context` hook receives request options that are treated as explicit configuration: any field
already set to a non-null value in `event.options` (including values written by an earlier hook) is never overwritten.
`null` is treated as unset, matching V1 behavior. The hook has been observed to arrive with fields prepopulated (for
example `maxTokens`), so the plugin does not assume the object is empty.

When configuration layers disagree, the more specific layer wins, highest first:

1. fields already set to a non-null value in `event.options` (including earlier hooks) — never overwritten (`null` counts as unset)
2. the agent's request `settings`
3. the selected variant's `settings`
4. model `settings`

Profile values fill only the sampling fields left unset by all of those layers.

When a model reference matches a profile but its model record cannot be resolved, the plugin fails closed: it writes no
profile values, because it cannot distinguish an unset field from a user-configured one. The skip is logged once per
model reference; the plugin retries after its 30-second negative-cache entry expires, and the cache is cleared immediately
when the model list or agent list changes (`model.updated` / `agent.updated`). The same applies when the agent record
cannot be resolved; an agent-read failure also retries after that short TTL.

V1 note: a V1 model record exposes both `modelID` and `api.id`, and either id may match a profile. A record whose two ids
disagree therefore still resolves its profile; earlier versions matched only the first non-empty id. This is deliberate:
failing to match would silently keep the wrong sampling values.

OpenCode V2 model capabilities expose only `tools`, `input`, and `output`; there is no temperature capability signal to
inspect. The `capabilities.temperature === false` guard therefore only applies to V1-shaped models.

For the legacy Gemini profile, this environment variable remains supported:

- `OPENCODE_GEMINI3_TEMPERATURE`: target temperature, default `0.35`.

## Development

```sh
npm install
npm test
node --check index.js
node --check src/index.js
node --check src/profiles.js
npm pack --dry-run
```

The package ships two entrypoints from one default export:

- `Plugin.define({ id, setup })` for OpenCode V2, registering the session `context` hook.
- `server()` for OpenCode V1 (`1.18.29` and newer), returning the `chat.params` hook.
