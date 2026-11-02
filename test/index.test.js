import assert from "node:assert/strict"
import { afterEach, beforeEach, test } from "node:test"

import {
  OptimalModelTemperaturesPlugin,
  PLUGIN_ID,
  applyProfile,
  applyRequestProfile,
  detectSamplingMode,
} from "../src/index.js"
import OptimalModelTemperaturesPluginV2 from "../src/index.js"
import ShippedPlugin, { PLUGIN_ID as SHIPPED_PLUGIN_ID } from "../index.js"

const ENV_KEYS = [
  "OPENCODE_SAMPLING_MODE",
  "OPENCODE_GEMINI3_TEMPERATURE",
]

function makeModel(modelID, options = {}) {
  const {
    provider = "test-provider",
    modelOptions = {},
    capabilities = { temperature: true },
  } = options

  return {
    providerID: provider,
    modelID,
    api: { id: modelID },
    options: modelOptions,
    capabilities,
  }
}

function makeOutput(values = {}) {
  return {
    temperature: undefined,
    topP: undefined,
    topK: undefined,
    options: {},
    ...values,
  }
}

function captureWarnings(t) {
  const warnings = []
  const original = console.warn
  console.warn = (...args) => warnings.push(args.join(" "))
  t.after(() => {
    console.warn = original
  })
  return warnings
}

function makeEventStream() {
  const queue = []
  let resolveNext
  let finished = false

  const settle = (result) => {
    const resolve = resolveNext
    resolveNext = undefined
    resolve?.(result)
  }

  return {
    push(item) {
      if (resolveNext) settle({ value: item, done: false })
      else queue.push(item)
    },
    subscribe({ signal } = {}) {
      signal?.addEventListener(
        "abort",
        () => {
          finished = true
          settle({ value: undefined, done: true })
        },
        { once: true },
      )
      return {
        [Symbol.asyncIterator]() {
          return {
            next() {
              if (queue.length) return Promise.resolve({ value: queue.shift(), done: false })
              if (finished) return Promise.resolve({ value: undefined, done: true })
              return new Promise((resolve) => {
                resolveNext = resolve
              })
            },
            return() {
              finished = true
              return Promise.resolve({ value: undefined, done: true })
            },
          }
        },
      }
    },
  }
}

beforeEach(() => {
  for (const key of ENV_KEYS) delete process.env[key]
})

afterEach(() => {
  for (const key of ENV_KEYS) delete process.env[key]
})

test("detects thinking and non-thinking option shapes", () => {
  assert.equal(
    detectSamplingMode(makeModel("kimi-k2.6", { modelOptions: { enable_thinking: true } }), makeOutput()),
    "thinking",
  )
  assert.equal(
    detectSamplingMode(makeModel("kimi-k2.6", { modelOptions: { thinking: { type: "disabled" } } }), makeOutput()),
    "nonThinking",
  )
  assert.equal(
    detectSamplingMode(
      makeModel("minimax-m3", { modelOptions: { chat_template_kwargs: { thinking: false } } }),
      makeOutput(),
    ),
    "nonThinking",
  )
  assert.equal(
    detectSamplingMode(makeModel("minimax-m3", { modelOptions: { thinking: true } }), makeOutput()),
    "thinking",
  )
  assert.equal(
    detectSamplingMode(makeModel("minimax-m3", { modelOptions: { thinking: false } }), makeOutput()),
    "nonThinking",
  )
  assert.equal(
    detectSamplingMode(makeModel("minimax-m3", { modelOptions: { thinking: 0 } }), makeOutput()),
    "nonThinking",
  )
  assert.equal(
    detectSamplingMode(makeModel("minimax-m3", { modelOptions: { thinking: { type: "custom" } } }), makeOutput()),
    "thinking",
  )
  assert.equal(
    detectSamplingMode(makeModel("kimi-k2.6", { modelOptions: { thinking: "adaptive" } }), makeOutput()),
    "thinking",
  )
  assert.equal(
    detectSamplingMode(makeModel("kimi-k2.6", { modelOptions: { thinking: 1 } }), makeOutput()),
    "thinking",
  )
  assert.equal(
    detectSamplingMode(makeModel("minimax-m3", { modelOptions: { thinking: undefined } }), makeOutput()),
    "thinking",
  )
  assert.equal(detectSamplingMode(makeModel("kimi-k2.6"), makeOutput()), "nonThinking")
})

test("applies Kimi K2.x family values in both modes", () => {
  for (const modelID of ["kimi-k2.6", "kimi-k2.7"]) {
    const thinkingOutput = makeOutput()
    assert.equal(
      applyProfile(
        makeModel(modelID, { modelOptions: { reasoningEffort: "high" } }),
        thinkingOutput,
      ),
      true,
    )
    assert.equal(thinkingOutput.temperature, 1.0)
    assert.equal(thinkingOutput.topP, 0.95)
    assert.equal(thinkingOutput.topK, undefined)

    const instantOutput = makeOutput()
    assert.equal(
      applyProfile(
        makeModel(modelID, { modelOptions: { enable_thinking: false } }),
        instantOutput,
      ),
      true,
    )
    assert.equal(instantOutput.temperature, 0.6)
    assert.equal(instantOutput.topP, 0.95)
    assert.equal(instantOutput.topK, undefined)
  }
})

test("defaults MiniMax M3 to non-thinking when no mode is specified", () => {
  const output = makeOutput()
  assert.equal(applyProfile(makeModel("minimax-m3"), output), true)
  assert.equal(output.temperature, 1.0)
  assert.equal(output.topP, 0.95)
})

test("applies the same MiniMax M2.x values in both modes", () => {
  for (const modelID of ["minimax-m2", "minimax-m2.1", "minimax-m2.5", "minimax-m2.7"]) {
    const defaultOutput = makeOutput()
    assert.equal(applyProfile(makeModel(modelID), defaultOutput), true)
    assert.equal(defaultOutput.temperature, 1.0)
    assert.equal(defaultOutput.topP, 0.95)

    const nonThinkingOutput = makeOutput()
    assert.equal(
      applyProfile(
        makeModel(modelID, { modelOptions: { thinking: { type: "disabled" } } }),
        nonThinkingOutput,
      ),
      true,
    )
    assert.equal(nonThinkingOutput.temperature, 1.0)
    assert.equal(nonThinkingOutput.topP, 0.95)
  }
})

test("keeps Kimi K2.7 Code thinking-only on every provider", () => {
  const cases = [
    ["kimi-k2.7-code", "opencode-go"],
    ["moonshotai/Kimi-K2.7-Code", "commandcode"],
    ["moonshotai/Kimi-K2.7-Code-Highspeed", "commandcode"],
  ]

  for (const [modelID, provider] of cases) {
    const thinkingOutput = makeOutput()
    assert.equal(
      applyProfile(
        makeModel(modelID, { provider, modelOptions: { reasoningEffort: "high" } }),
        thinkingOutput,
      ),
      true,
      `${modelID} should apply thinking values`,
    )
    assert.equal(thinkingOutput.temperature, 1.0)
    assert.equal(thinkingOutput.topP, 0.95)

    const nonThinkingOutput = makeOutput()
    assert.equal(
      applyProfile(
        makeModel(modelID, { provider, modelOptions: { thinking: { type: "disabled" } } }),
        nonThinkingOutput,
      ),
      false,
      `${modelID} should not fill the non-thinking slot`,
    )
    assert.equal(nonThinkingOutput.temperature, undefined)
    assert.equal(nonThinkingOutput.topP, undefined)
  }
})

test("applies separate GLM-5 hybrid profiles", () => {
  for (const modelID of ["glm-5", "glm-5.1", "glm-5.2"]) {
    const thinkingOutput = makeOutput()
    assert.equal(
      applyProfile(
        makeModel(modelID, { modelOptions: { reasoningEffort: "high" } }),
        thinkingOutput,
      ),
      true,
    )
    assert.equal(thinkingOutput.temperature, 1.0)
    assert.equal(thinkingOutput.topP, undefined)

    const nonThinkingOutput = makeOutput()
    assert.equal(
      applyProfile(
        makeModel(modelID, { modelOptions: { thinking: { type: "disabled" } } }),
        nonThinkingOutput,
      ),
      true,
    )
    assert.equal(nonThinkingOutput.temperature, 0.6)
    assert.equal(nonThinkingOutput.topP, undefined)
  }
})

test("defaults an unspecified mode to non-thinking when supported", () => {
  const glmOutput = makeOutput()
  assert.equal(applyProfile(makeModel("glm-5.1"), glmOutput), true)
  assert.equal(glmOutput.temperature, 0.6)

  const kimiOutput = makeOutput()
  assert.equal(applyProfile(makeModel("kimi-k3"), kimiOutput), true)
  assert.equal(kimiOutput.temperature, 0.6)
  assert.equal(kimiOutput.topP, 0.95)
})

test("applies GLM-5.3 family non-thinking values", () => {
  const thinkingOutput = makeOutput()
  assert.equal(
    applyProfile(
      makeModel("glm-5.3", { modelOptions: { reasoningEffort: "high" } }),
      thinkingOutput,
    ),
    true,
  )
  assert.equal(thinkingOutput.temperature, 1.0)

  const nonThinkingOutput = makeOutput()
  assert.equal(
    applyProfile(
      makeModel("glm-5.3", { modelOptions: { thinking: { type: "disabled" } } }),
      nonThinkingOutput,
    ),
    true,
  )
  assert.equal(nonThinkingOutput.temperature, 0.6)
})

test("keeps OpenCode Go GLM-5.x thinking-only", () => {
  for (const modelID of ["glm-5.1", "glm-5.2", "glm-5.3"]) {
    const thinkingOutput = makeOutput()
    assert.equal(
      applyProfile(
        makeModel(modelID, {
          provider: "opencode-go",
          modelOptions: { reasoningEffort: "high" },
        }),
        thinkingOutput,
      ),
      true,
    )
    assert.equal(thinkingOutput.temperature, 1.0)

    const nonThinkingOutput = makeOutput()
    assert.equal(
      applyProfile(
        makeModel(modelID, {
          provider: "opencode-go",
          modelOptions: { thinking: { type: "disabled" } },
        }),
        nonThinkingOutput,
      ),
      false,
    )
    assert.equal(nonThinkingOutput.temperature, undefined)
  }
})

test("applies Qwen3.x mode-specific values when fields are absent", () => {
  const cases = [
    ["qwen3.5", { reasoningEffort: "high" }, 0.6, 0.95],
    ["qwen3.5", { thinking: { type: "disabled" } }, 0.7, 0.8],
    ["qwen3.6-plus", { reasoningEffort: "high" }, 1.0, 0.95],
    ["qwen3.6-plus", { thinking: { type: "disabled" } }, 0.7, 0.8],
    ["qwen3.8-flash", { reasoningEffort: "high" }, 1.0, 0.95],
    ["qwen3.8-flash", { thinking: { type: "disabled" } }, 0.7, 0.8],
    ["qwen3-coder", { thinking: { type: "disabled" } }, 0.7, 0.8],
  ]
  for (const [modelID, modelOptions, temperature, topP] of cases) {
    const output = makeOutput()
    assert.equal(applyProfile(makeModel(modelID, { modelOptions }), output), true)
    assert.equal(output.temperature, temperature)
    assert.equal(output.topP, topP)
    assert.equal(output.topK, undefined)
  }
})

test("reuses the same Qwen3.8 Max values for both mode slots", () => {
  for (const modelOptions of [{ reasoningEffort: "high" }, { thinking: { type: "disabled" } }, {}]) {
    const output = makeOutput()
    assert.equal(applyProfile(makeModel("qwen3.8-max", { modelOptions }), output), true)
    assert.equal(output.temperature, 1.0)
    assert.equal(output.topP, 0.95)
  }
})

test("prefers a model rule and falls back to the family rule", () => {
  // Model rule wins over the broader family rule.
  const qwen35 = makeOutput()
  assert.equal(
    applyProfile(makeModel("qwen3.5-plus", { modelOptions: { reasoningEffort: "high" } }), qwen35),
    true,
  )
  assert.equal(qwen35.temperature, 0.6)

  // Family rule applies when no model rule matches.
  const qwen36 = makeOutput()
  assert.equal(
    applyProfile(makeModel("qwen3.6-plus", { modelOptions: { reasoningEffort: "high" } }), qwen36),
    true,
  )
  assert.equal(qwen36.temperature, 1.0)

  // Route-specific model rule overrides the family on its route only.
  const glmGo = makeOutput()
  assert.equal(
    applyProfile(
      makeModel("glm-5.2", { provider: "opencode-go", modelOptions: { thinking: { type: "disabled" } } }),
      glmGo,
    ),
    false,
  )

  const glmOther = makeOutput()
  assert.equal(
    applyProfile(makeModel("glm-5.2", { provider: "other", modelOptions: { thinking: { type: "disabled" } } }), glmOther),
    true,
  )
  assert.equal(glmOther.temperature, 0.6)
})

test("matches vendor-namespaced gateway ids", () => {
  const cases = [
    ["deepseek/deepseek-v4.1-flash", { reasoningEffort: "high" }, 1.0, 1.0],
    ["z-ai/glm-5.3-flash", { reasoningEffort: "high" }, 1.0, undefined],
    ["zai-org/GLM-5.3", { reasoningEffort: "high" }, 1.0, undefined],
    ["Qwen/Qwen3.8-Max", { reasoningEffort: "high" }, 1.0, 0.95],
    ["xai/grok-4.7", { enable_thinking: false }, 0.7, 0.95],
    ["tencent/hy3-paid", { reasoningEffort: "high" }, 0.9, 1.0],
    ["meituan/LongCat-2.0", { reasoningEffort: "high" }, undefined, 0.95],
    ["MiniMaxAI/MiniMax-M3", { reasoningEffort: "high" }, 1.0, 0.95],
    ["moonshotai/Kimi-K3", { reasoningEffort: "high" }, 1.0, 0.95],
  ]
  for (const [modelID, modelOptions, temperature, topP] of cases) {
    const output = makeOutput()
    assert.equal(
      applyProfile(makeModel(modelID, { provider: "commandcode", modelOptions }), output),
      true,
      `${modelID} should match a profile`,
    )
    assert.equal(output.temperature, temperature)
    assert.equal(output.topP, topP)
  }

  // Namespaced ids with no profile are still left untouched.
  for (const modelID of ["poolside/laguna-s-2.1-free", "meta/muse-spark-1.3", "stepfun/Step-5-Preview", "sakana/fugu-ultra"]) {
    const output = makeOutput()
    assert.equal(applyProfile(makeModel(modelID, { provider: "commandcode" }), output), false)
    assert.equal(output.temperature, undefined)
  }
})

test("applies DeepSeek V4.x family values in both modes", () => {
  const nonThinkingOutput = makeOutput()
  assert.equal(
    applyProfile(
      makeModel("deepseek-v4-pro", { modelOptions: { thinking: { type: "disabled" } } }),
      nonThinkingOutput,
    ),
    true,
  )
  assert.equal(nonThinkingOutput.temperature, 1.0)
  assert.equal(nonThinkingOutput.topP, 1.0)

  const thinkingOutput = makeOutput()
  assert.equal(
    applyProfile(
      makeModel("deepseek-v4-pro", { modelOptions: { reasoningEffort: "high" } }),
      thinkingOutput,
    ),
    true,
  )
  assert.equal(thinkingOutput.temperature, 1.0)
  assert.equal(thinkingOutput.topP, 1.0)
})

test("matches DeepSeek V4.x aliases", () => {
  for (const modelID of ["deepseek-v4", "deepseek-v4.1", "deepseek-v4-pro"]) {
    const output = makeOutput()
    assert.equal(
      applyProfile(
        makeModel(modelID, { modelOptions: { reasoningEffort: "high" } }),
        output,
      ),
      true,
    )
    assert.equal(output.temperature, 1.0)
    assert.equal(output.topP, 1.0)
  }
})

test("applies Kimi K3.x family non-thinking values on the Go route", () => {
  for (const modelID of ["kimi-k3", "kimi-k3.1"]) {
    const output = makeOutput()
    assert.equal(
      applyProfile(
        makeModel(modelID, {
          provider: "opencode-go",
          modelOptions: { thinking: { type: "disabled" } },
        }),
        output,
      ),
      true,
    )
    assert.equal(output.temperature, 0.6)
    assert.equal(output.topP, 0.95)
  }
})

test("uses recognized and fallback MiniMax M3 modes", () => {
  for (const mode of ["adaptive", "disabled", "enabled", "true", "1", "custom"]) {
    const output = makeOutput()
    assert.equal(
      applyProfile(
        makeModel("minimax-m3", {
          provider: "opencode-go",
          modelOptions: { thinking: { type: mode } },
        }),
        output,
      ),
      true,
    )
    assert.equal(output.temperature, 1.0)
    assert.equal(output.topP, 0.95)
  }
})

test("applies MiMo V2.x family values in both modes", () => {
  for (const modelID of ["mimo-v2.5", "mimo-v2-flash"]) {
    const thinkingOutput = makeOutput()
    assert.equal(
      applyProfile(
        makeModel(modelID, { modelOptions: { reasoningEffort: "high" } }),
        thinkingOutput,
      ),
      true,
    )
    assert.equal(thinkingOutput.temperature, 1.0)
    assert.equal(thinkingOutput.topP, 0.95)

    const nonThinkingOutput = makeOutput()
    assert.equal(
      applyProfile(
        makeModel(modelID, { modelOptions: { thinking: { type: "disabled" } } }),
        nonThinkingOutput,
      ),
      true,
    )
    assert.equal(nonThinkingOutput.temperature, 1.0)
    assert.equal(nonThinkingOutput.topP, 0.95)
  }
})

test("applies Grok 4.x family values in both modes", () => {
  for (const modelID of ["grok-4.5", "grok-4.6", "grok-4.7", "grok-4.20-0309-reasoning"]) {
    for (const modelOptions of [{ reasoningEffort: "high" }, { enable_thinking: false }]) {
      const output = makeOutput()
      assert.equal(applyProfile(makeModel(modelID, { modelOptions }), output), true)
      assert.equal(output.temperature, 0.7)
      assert.equal(output.topP, 0.95)
      assert.equal(output.topK, undefined)
    }
  }
})

test("applies grok-build values in both modes", () => {
  for (const modelOptions of [{ reasoningEffort: "high" }, { enable_thinking: false }]) {
    const output = makeOutput()
    assert.equal(applyProfile(makeModel("grok-build-0.1", { modelOptions }), output), true)
    assert.equal(output.temperature, 0.7)
    assert.equal(output.topP, 0.95)
    assert.equal(output.topK, undefined)
  }
})

test("applies Hunyuan Hy3 and Hy4 values separately in both modes", () => {
  for (const modelID of ["hy3", "hy4-preview"]) {
    for (const modelOptions of [{ reasoningEffort: "high" }, { thinking: { type: "disabled" } }]) {
      const output = makeOutput()
      assert.equal(applyProfile(makeModel(modelID, { modelOptions }), output), true)
      assert.equal(output.temperature, 0.9)
      assert.equal(output.topP, 1.0)
    }
  }
})

test("applies LongCat top_p and leaves server-managed temperature unset", () => {
  for (const modelID of ["longcat-2.0", "longcat-2.5-preview-free"]) {
    for (const modelOptions of [{ reasoningEffort: "high" }, { thinking: { type: "disabled" } }]) {
      const output = makeOutput()
      assert.equal(applyProfile(makeModel(modelID, { modelOptions }), output), true)
      assert.equal(output.temperature, undefined)
      assert.equal(output.topP, 0.95)
    }
  }
})

test("does not match near-miss or unsupported model ids", () => {
  for (const modelID of ["grok", "grok-", "grok-3", "hy2", "hy5", "hy35", "longcat", "longcat-1", "claude-sonnet-5-5", "step-5-preview"]) {
    const output = makeOutput()
    assert.equal(applyProfile(makeModel(modelID), output), false)
    assert.equal(output.temperature, undefined)
    assert.equal(output.topP, undefined)
  }
})

test("matches either the catalog or upstream id when a V1 model's ids disagree", () => {
  // Deliberate V1 behavior change: the V2 catalog exposes both ids, and a model whose two
  // ids disagree must still find its profile rather than silently keep the wrong sampling.
  for (const [modelID, apiId] of [
    ["claude-sonnet-5-5", "kimi-k3"],
    ["kimi-k3", "claude-sonnet-5-5"],
  ]) {
    const output = makeOutput()
    const model = {
      providerID: "test-provider",
      modelID,
      api: { id: apiId },
      options: {},
      capabilities: { temperature: true },
    }
    assert.equal(applyProfile(model, output), true, `${modelID}/${apiId} should match the kimi-k3 profile`)
    assert.equal(output.temperature, 0.6)
    assert.equal(output.topP, 0.95)
  }
})

test("preserves explicit sampling values", () => {
  const output = makeOutput({ temperature: 0.42, topP: 0.5 })
  assert.equal(
    applyProfile(
      makeModel("kimi-k2.6", { modelOptions: { enable_thinking: true } }),
      output,
    ),
    false,
  )
  assert.equal(output.temperature, 0.42)
  assert.equal(output.topP, 0.5)
})

test("skips temperature when the model capability is disabled", () => {
  const output = makeOutput()
  const model = makeModel("kimi-k3", {
    capabilities: { temperature: false },
  })
  assert.equal(applyProfile(model, output), true)
  assert.equal(output.temperature, undefined)
  assert.equal(output.topP, 0.95)
})

test("applies Go-specific Kimi values in thinking mode", () => {
  for (const modelID of ["kimi-k3", "kimi-k2.7-code"]) {
    const output = makeOutput()
    const model = makeModel(modelID, {
      provider: "opencode-go",
      modelOptions: { reasoningEffort: "high" },
    })
    assert.equal(applyProfile(model, output), true)
    assert.equal(output.temperature, 1.0)
    assert.equal(output.topP, 0.95)
    assert.equal(output.topK, undefined)
  }
})

test("supports the legacy Gemini temperature override for unset fields", () => {
  process.env.OPENCODE_GEMINI3_TEMPERATURE = "0.42"

  const model = makeModel("gemini-3-pro", { provider: "google" })
  const unsetOutput = makeOutput()
  assert.equal(applyProfile(model, unsetOutput), true)
  assert.equal(unsetOutput.temperature, 0.42)

  const explicitOutput = makeOutput({ temperature: 1 })
  assert.equal(applyProfile(model, explicitOutput), false)
  assert.equal(explicitOutput.temperature, 1)
})

test("exports a working chat.params hook", async () => {
  process.env.OPENCODE_SAMPLING_MODE = "thinking"
  const hooks = await OptimalModelTemperaturesPlugin()
  const output = makeOutput()

  await hooks["chat.params"](
    { model: makeModel("kimi-k3", { provider: "kimi" }) },
    output,
  )

  assert.equal(output.temperature, 1.0)
  assert.equal(output.topP, 0.95)
})

function makeModelInfo(modelID, options = {}) {
  const { provider = "test-provider", settings = {}, variants = [] } = options
  return {
    id: modelID,
    modelID,
    providerID: provider,
    name: modelID,
    settings,
    variants,
    capabilities: { tools: true, input: ["text"], output: ["text"] },
  }
}

test("V2 context hook picks per-model values and leaves unknown models alone", () => {
  const kimi = { model: { providerID: "moonshot", id: "kimi-k3" }, options: {} }
  assert.equal(
    applyRequestProfile(kimi, makeModelInfo("kimi-k3", { provider: "moonshot", settings: { reasoningEffort: "high" } })),
    true,
  )
  assert.equal(kimi.options.temperature, 1.0)
  assert.equal(kimi.options.topP, 0.95)

  const glm = { model: { providerID: "z-ai", id: "glm-5.3" }, options: {} }
  assert.equal(
    applyRequestProfile(glm, makeModelInfo("glm-5.3", { provider: "z-ai", settings: { reasoningEffort: "high" } })),
    true,
  )
  assert.equal(glm.options.temperature, 1.0)
  assert.equal(glm.options.topP, undefined)

  const unknown = { model: { providerID: "acme", id: "acme-1" }, options: {} }
  assert.equal(applyRequestProfile(unknown, makeModelInfo("acme-1", { provider: "acme" })), false)
  assert.deepEqual(unknown.options, {})
})

test("V2 hook selects the non-thinking slot from configured sampling options", () => {
  const event = {
    model: { providerID: "moonshot", id: "kimi-k3" },
    options: {},
  }
  assert.equal(
    applyRequestProfile(
      event,
      makeModelInfo("kimi-k3", {
        provider: "moonshot",
        settings: { thinking: { type: "disabled" } },
      }),
    ),
    true,
  )
  assert.equal(event.options.temperature, 0.6)
  assert.equal(event.options.topP, 0.95)
})

test("V2 hook keeps model, variant, and prior request values untouched", () => {
  const configured = {
    model: { providerID: "moonshot", id: "kimi-k3" },
    options: {},
  }
  assert.equal(
    applyRequestProfile(
      configured,
      makeModelInfo("kimi-k3", { provider: "moonshot", settings: { temperature: 0.2 } }),
    ),
    true,
  )
  assert.deepEqual(configured.options, { topP: 0.95 })

  const variant = {
    model: { providerID: "moonshot", id: "kimi-k3", variant: "cold" },
    options: {},
  }
  assert.equal(
    applyRequestProfile(
      variant,
      makeModelInfo("kimi-k3", {
        provider: "moonshot",
        settings: { temperature: 0.2 },
        variants: [{ id: "cold", settings: { topP: 0.5 } }],
      }),
    ),
    false,
  )
  assert.deepEqual(variant.options, {})

  const prior = {
    model: { providerID: "moonshot", id: "kimi-k3" },
    options: { temperature: 0.42 },
  }
  assert.equal(applyRequestProfile(prior, makeModelInfo("kimi-k3", { provider: "moonshot" })), true)
  assert.equal(prior.options.temperature, 0.42)
  assert.equal(prior.options.topP, 0.95)
})

test("V2 hook matches namespaced ids through the upstream model id", () => {
  const event = { model: { providerID: "commandcode", id: "deepseek-v4.1-flash" }, options: {} }
  const info = {
    ...makeModelInfo("deepseek-v4.1-flash", { provider: "commandcode" }),
    id: "deepseek-v4.1-flash",
    modelID: "deepseek/deepseek-v4.1-flash",
  }
  assert.equal(applyRequestProfile(event, info), true)
  assert.equal(event.options.temperature, 1.0)
  assert.equal(event.options.topP, 1.0)
})

test("V2 plugin registers a context hook on a stable id", async () => {
  const captured = []
  const ctx = {
    model: {
      list: async () => ({
        data: [makeModelInfo("kimi-k3", { provider: "moonshot", settings: { reasoningEffort: "high" } })],
      }),
    },
    agent: { get: async () => ({ data: { id: "build", request: { settings: {} } } }) },
    session: {
      hook: async (name, callback) => {
        captured.push({ name, callback })
        return { dispose: async () => {} }
      },
    },
  }

  const cleanup = await OptimalModelTemperaturesPluginV2.setup(ctx)
  assert.equal(typeof cleanup, "function")
  assert.equal(captured.length, 1)
  assert.equal(captured[0].name, "context")

  const event = { model: { providerID: "moonshot", id: "kimi-k3" }, agent: "build", options: {} }
  await captured[0].callback(event)
  assert.equal(event.options.temperature, 1.0)
  assert.equal(event.options.topP, 0.95)

  await cleanup()
})

test("V2 context hook unwraps the agent response and preserves agent request settings", async () => {
  const captured = []
  let agentCalls = 0
  const ctx = {
    model: {
      list: async () => ({ data: [makeModelInfo("kimi-k3", { provider: "moonshot" })] }),
    },
    agent: {
      get: async () => {
        agentCalls += 1
        return { data: { id: "build", request: { settings: { temperature: 0.11 } } } }
      },
    },
    session: {
      hook: async (name, callback) => {
        captured.push({ name, callback })
        return { dispose: async () => {} }
      },
    },
  }

  const cleanup = await OptimalModelTemperaturesPluginV2.setup(ctx)
  const event = { model: { providerID: "moonshot", id: "kimi-k3" }, agent: "build", options: {} }
  await captured[0].callback(event)

  // The agent explicitly configured temperature, so the profile must not write it.
  assert.equal(event.options.temperature, undefined)
  assert.equal("temperature" in event.options, false)
  // Fields the agent did not configure are still filled from the profile.
  assert.equal(event.options.topP, 0.95)
  assert.equal(agentCalls, 1)

  await cleanup()
})

test("V2 hook applies agent, variant, and model settings in declared precedence order", () => {
  // Variant (non-thinking) refines the model (thinking): the variant must win.
  const variantWins = {
    model: { providerID: "moonshot", id: "kimi-k3", variant: "instant" },
    options: {},
  }
  assert.equal(
    applyRequestProfile(
      variantWins,
      makeModelInfo("kimi-k3", {
        provider: "moonshot",
        settings: { reasoningEffort: "high" },
        variants: [{ id: "instant", settings: { thinking: { type: "disabled" } } }],
      }),
    ),
    true,
  )
  assert.equal(variantWins.options.temperature, 0.6)
  assert.equal(variantWins.options.topP, 0.95)

  // Model (non-thinking) with a variant that requests thinking: the variant must win.
  const modelNonThinking = {
    model: { providerID: "moonshot", id: "kimi-k3", variant: "deep" },
    options: {},
  }
  assert.equal(
    applyRequestProfile(
      modelNonThinking,
      makeModelInfo("kimi-k3", {
        provider: "moonshot",
        settings: { thinking: { type: "disabled" } },
        variants: [{ id: "deep", settings: { reasoningEffort: "high" } }],
      }),
    ),
    true,
  )
  assert.equal(modelNonThinking.options.temperature, 1.0)

  // Agent request settings outrank the selected variant.
  const agentWins = {
    model: { providerID: "moonshot", id: "kimi-k3", variant: "instant" },
    options: {},
  }
  assert.equal(
    applyRequestProfile(
      agentWins,
      makeModelInfo("kimi-k3", {
        provider: "moonshot",
        variants: [{ id: "instant", settings: { thinking: { type: "disabled" } } }],
      }),
      { request: { settings: { reasoningEffort: "high" } } },
    ),
    true,
  )
  assert.equal(agentWins.options.temperature, 1.0)
})

test("V2 hook does not let a present-but-undefined higher-layer key erase a lower defined value", () => {
  // Reproduces the old undefined-leaf merge bug: `{ temperature: undefined }` in the highest
  // layer used to read as unset, so the profile overwrote the model's explicit 0.2 with 0.6.
  const event = {
    model: { providerID: "moonshot", id: "kimi-k3" },
    options: { temperature: undefined },
  }
  assert.equal(
    applyRequestProfile(
      event,
      makeModelInfo("kimi-k3", { provider: "moonshot", settings: { temperature: 0.2 } }),
    ),
    true,
  )
  // The profile did not overwrite the model's 0.2 (it never copies lower-layer values into
  // options); the empty higher-layer key simply does not hide it.
  assert.equal(event.options.temperature, undefined)
  // Fields no layer defines are still filled from the profile.
  assert.equal(event.options.topP, 0.95)
})

test("V2 hook lets OPENCODE_SAMPLING_MODE outrank the highest settings source", () => {
  process.env.OPENCODE_SAMPLING_MODE = "thinking"
  const event = { model: { providerID: "moonshot", id: "kimi-k3" }, options: {} }
  assert.equal(
    applyRequestProfile(
      event,
      makeModelInfo("kimi-k3", {
        provider: "moonshot",
        settings: { thinking: { type: "disabled" } },
      }),
    ),
    true,
  )
  // The forced mode selects the thinking slot (1.0), not the model's non-thinking slot (0.6).
  assert.equal(event.options.temperature, 1.0)
  assert.equal(event.options.topP, 0.95)
})

test("V2 hook fails closed when model info cannot be resolved", () => {
  const event = { model: { providerID: "moonshot", id: "kimi-k3" }, options: {} }
  const skipped = []
  assert.equal(
    applyRequestProfile(event, undefined, undefined, (reason) => skipped.push(reason)),
    false,
  )
  assert.deepEqual(event.options, {})
  assert.deepEqual(skipped, ["model-info-unavailable"])

  // A reference without a matching profile needs no model record and stays untouched.
  const unknown = { model: { providerID: "acme", id: "acme-1" }, options: {} }
  const unknownSkipped = []
  assert.equal(
    applyRequestProfile(unknown, undefined, undefined, (reason) => unknownSkipped.push(reason)),
    false,
  )
  assert.deepEqual(unknown.options, {})
  assert.deepEqual(unknownSkipped, [])
})

test("V2 hook resolves a model record through its canonical provider id", async () => {
  const captured = []
  const model = { ...makeModelInfo("kimi-k3", { provider: "openrouter" }), canonical: "moonshot" }
  const ctx = {
    model: { list: async () => ({ data: [model] }) },
    agent: { get: async () => ({ data: { id: "build", request: { settings: {} } } }) },
    session: {
      hook: async (name, callback) => {
        captured.push({ name, callback })
        return { dispose: async () => {} }
      },
    },
  }

  const cleanup = await OptimalModelTemperaturesPluginV2.setup(ctx)
  const event = { model: { providerID: "moonshot", id: "kimi-k3" }, agent: "build", options: {} }
  await captured[0].callback(event)
  assert.equal(event.options.temperature, 0.6)
  assert.equal(event.options.topP, 0.95)

  await cleanup()
})

test("V2 hook caches model and agent lookups between requests", async () => {
  const captured = []
  let modelCalls = 0
  let agentCalls = 0
  const ctx = {
    model: {
      list: async () => {
        modelCalls += 1
        return {
          data: [makeModelInfo("kimi-k3", { provider: "moonshot", settings: { reasoningEffort: "high" } })],
        }
      },
    },
    agent: {
      get: async () => {
        agentCalls += 1
        return { data: { id: "build", request: { settings: {} } } }
      },
    },
    session: {
      hook: async (name, callback) => {
        captured.push({ name, callback })
        return { dispose: async () => {} }
      },
    },
  }

  const cleanup = await OptimalModelTemperaturesPluginV2.setup(ctx)
  for (let i = 0; i < 3; i += 1) {
    const event = { model: { providerID: "moonshot", id: "kimi-k3" }, agent: "build", options: {} }
    await captured[0].callback(event)
    assert.equal(event.options.temperature, 1.0)
  }

  assert.equal(modelCalls, 1)
  assert.equal(agentCalls, 1)

  await cleanup()
})

test("V2 hook prefers the exact providerID record over a same-id canonical match in either list order", async () => {
  const records = () => [
    {
      ...makeModelInfo("kimi-k3", { provider: "openrouter", settings: { temperature: 0.2 } }),
      canonical: "moonshot",
    },
    makeModelInfo("kimi-k3", { provider: "moonshot" }),
  ]

  for (const list of [records(), records().reverse()]) {
    const captured = []
    const ctx = {
      model: { list: async () => ({ data: list }) },
      agent: { get: async () => ({ data: { id: "build", request: { settings: {} } } }) },
      session: {
        hook: async (name, callback) => {
          captured.push({ name, callback })
          return { dispose: async () => {} }
        },
      },
    }

    const cleanup = await OptimalModelTemperaturesPluginV2.setup(ctx)
    const event = { model: { providerID: "moonshot", id: "kimi-k3" }, agent: "build", options: {} }
    await captured[0].callback(event)

    // The openrouter record's `settings.temperature` must not suppress the profile.
    assert.equal(event.options.temperature, 0.6)
    assert.equal(event.options.topP, 0.95)

    await cleanup()
  }
})

test("V2 hook fails closed when the requested provider matches neither providerID nor canonical", async (t) => {
  const warnings = captureWarnings(t)
  const captured = []
  const records = [
    makeModelInfo("kimi-k3", { provider: "openrouter", settings: { temperature: 0.2 } }),
    makeModelInfo("kimi-k3", { provider: "anthropic" }),
  ]
  const ctx = {
    model: { list: async () => ({ data: records }) },
    agent: { get: async () => ({ data: { id: "build", request: { settings: {} } } }) },
    session: {
      hook: async (name, callback) => {
        captured.push({ name, callback })
        return { dispose: async () => {} }
      },
    },
  }

  const cleanup = await OptimalModelTemperaturesPluginV2.setup(ctx)
  for (let i = 0; i < 2; i += 1) {
    const event = { model: { providerID: "moonshot", id: "kimi-k3" }, agent: "build", options: {} }
    await captured[0].callback(event)
    // Fail closed: no candidate may be borrowed for a provider that owns none.
    assert.deepEqual(event.options, {})
  }

  // Exactly one skip warning across both calls (dedupe).
  assert.equal(warnings.length, 1)
  assert.match(warnings[0], /model-info-unavailable/)

  await cleanup()
})

test("V2 hook keeps thinking-only profiles inert in the non-thinking slot", () => {
  const skipped = []
  const event = { model: { providerID: "opencode-go", id: "kimi-k2.7-code" }, options: {} }
  const changed = applyRequestProfile(
    event,
    makeModelInfo("kimi-k2.7-code", { provider: "opencode-go", settings: { thinking: { type: "disabled" } } }),
    undefined,
    (reason) => skipped.push(reason),
  )
  assert.equal(changed, false)
  assert.deepEqual(event.options, {})
  assert.deepEqual(skipped, [])
})

test("V2 hook resolves a model record whose modelID matches the ref but whose id does not", async () => {
  const captured = []
  const record = { ...makeModelInfo("moonshotai/Kimi-K3", { provider: "commandcode" }), id: "kimi-k3" }
  const ctx = {
    model: { list: async () => ({ data: [record] }) },
    agent: { get: async () => ({ data: { id: "build", request: { settings: {} } } }) },
    session: {
      hook: async (name, callback) => {
        captured.push({ name, callback })
        return { dispose: async () => {} }
      },
    },
  }

  const cleanup = await OptimalModelTemperaturesPluginV2.setup(ctx)
  const event = { model: { providerID: "commandcode", id: "moonshotai/Kimi-K3" }, agent: "build", options: {} }
  await captured[0].callback(event)

  // Resolved through the modelID half of the record filter; the profile applies.
  assert.equal(event.options.temperature, 0.6)
  assert.equal(event.options.topP, 0.95)

  await cleanup()
})

test("V2 hook fails closed and reports agent-info-unavailable when agent.get rejects", async (t) => {
  const warnings = captureWarnings(t)
  const captured = []
  const ctx = {
    model: {
      list: async () => ({
        data: [makeModelInfo("kimi-k3", { provider: "moonshot" })],
      }),
    },
    agent: {
      get: async () => {
        throw new Error("agent lookup failed")
      },
    },
    session: {
      hook: async (name, callback) => {
        captured.push({ name, callback })
        return { dispose: async () => {} }
      },
    },
  }

  const cleanup = await OptimalModelTemperaturesPluginV2.setup(ctx)
  const event = { model: { providerID: "moonshot", id: "kimi-k3" }, agent: "build", options: {} }
  await captured[0].callback(event)

  assert.deepEqual(event.options, {})
  assert.equal(warnings.length, 1)
  assert.match(warnings[0], /agent-info-unavailable/)

  await cleanup()
})

test("V2 hook fails closed and warns once when model.list rejects", async (t) => {
  const warnings = captureWarnings(t)
  const captured = []
  let modelCalls = 0
  const ctx = {
    model: {
      list: async () => {
        modelCalls += 1
        throw new Error("model lookup failed")
      },
    },
    agent: { get: async () => ({ data: { id: "build", request: { settings: {} } } }) },
    session: {
      hook: async (name, callback) => {
        captured.push({ name, callback })
        return { dispose: async () => {} }
      },
    },
  }

  const cleanup = await OptimalModelTemperaturesPluginV2.setup(ctx)
  for (let i = 0; i < 2; i += 1) {
    const event = { model: { providerID: "moonshot", id: "kimi-k3" }, agent: "build", options: {} }
    await captured[0].callback(event)
    assert.deepEqual(event.options, {})
  }

  // The negative cache retries after its TTL, and the warn dedupe survives both calls.
  assert.equal(modelCalls, 1)
  assert.equal(warnings.length, 1)
  assert.match(warnings[0], /model-info-unavailable/)

  await cleanup()
})

test("V2 hook refetches after model.updated or agent.updated invalidates the cache", async () => {
  for (const updateType of ["model.updated", "agent.updated"]) {
    const captured = []
    let modelCalls = 0
    const versions = [
      makeModelInfo("kimi-k3", { provider: "moonshot", settings: { thinking: { type: "disabled" } } }),
      makeModelInfo("kimi-k3", { provider: "moonshot", settings: { reasoningEffort: "high" } }),
    ]
    const events = makeEventStream()
    const ctx = {
      model: {
        list: async () => {
          const index = Math.min(modelCalls, versions.length - 1)
          modelCalls += 1
          return { data: [versions[index]] }
        },
      },
      agent: { get: async () => ({ data: { id: "build", request: { settings: {} } } }) },
      event: { subscribe: (options) => events.subscribe(options) },
      session: {
        hook: async (name, callback) => {
          captured.push({ name, callback })
          return { dispose: async () => {} }
        },
      },
    }

    const cleanup = await OptimalModelTemperaturesPluginV2.setup(ctx)

    const first = { model: { providerID: "moonshot", id: "kimi-k3" }, agent: "build", options: {} }
    await captured[0].callback(first)
    assert.equal(first.options.temperature, 0.6, `${updateType}: first request uses the cached record`)

    events.push({ type: updateType })
    await new Promise((resolve) => setImmediate(resolve))

    const second = { model: { providerID: "moonshot", id: "kimi-k3" }, agent: "build", options: {} }
    await captured[0].callback(second)
    assert.equal(modelCalls, 2, `${updateType}: cache was invalidated`)
    assert.equal(second.options.temperature, 1.0, `${updateType}: refetched record applies`)

    await cleanup()
  }
})

test("V2 hook never throws out of a failing write and warns once", async (t) => {
  const warnings = captureWarnings(t)
  const captured = []
  const ctx = {
    model: {
      list: async () => ({ data: [makeModelInfo("kimi-k3", { provider: "moonshot" })] }),
    },
    agent: { get: async () => ({ data: { id: "build", request: { settings: {} } } }) },
    session: {
      hook: async (name, callback) => {
        captured.push({ name, callback })
        return { dispose: async () => {} }
      },
    },
  }

  const cleanup = await OptimalModelTemperaturesPluginV2.setup(ctx)
  const event = { model: { providerID: "moonshot", id: "kimi-k3" }, agent: "build", options: Object.freeze({}) }

  await assert.doesNotReject(captured[0].callback(event))
  assert.deepEqual(event.options, {})
  assert.equal(warnings.length, 1)
  assert.match(warnings[0], /hook-error/)

  await cleanup()
})

test("shipped entry exports the V2 definition and the V1 server entrypoint", async () => {
  assert.equal(SHIPPED_PLUGIN_ID, PLUGIN_ID)
  assert.equal(ShippedPlugin.id, PLUGIN_ID)
  assert.equal(typeof ShippedPlugin.setup, "function")
  assert.equal(typeof ShippedPlugin.server, "function")

  const hooks = await ShippedPlugin.server()
  assert.equal(typeof hooks["chat.params"], "function")
})
