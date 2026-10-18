import assert from "node:assert/strict"
import { afterEach, beforeEach, test } from "node:test"

import {
  OptimalModelTemperaturesPlugin,
  applyProfile,
  detectSamplingMode,
} from "../src/index.js"

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

test("keeps Kimi Code thinking-only on OpenCode Go", () => {
  const thinkingOutput = makeOutput()
  assert.equal(
    applyProfile(
      makeModel("kimi-k2.7-code", {
        provider: "opencode-go",
        modelOptions: { reasoningEffort: "high" },
      }),
      thinkingOutput,
    ),
    true,
  )
  assert.equal(thinkingOutput.temperature, 1.0)
  assert.equal(thinkingOutput.topP, 0.95)

  const nonThinkingOutput = makeOutput()
  assert.equal(
    applyProfile(
      makeModel("kimi-k2.7-code", {
        provider: "opencode-go",
        modelOptions: { thinking: { type: "disabled" } },
      }),
      nonThinkingOutput,
    ),
    false,
  )
  assert.equal(nonThinkingOutput.temperature, undefined)
  assert.equal(nonThinkingOutput.topP, undefined)
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
