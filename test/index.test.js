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
  "OPENCODE_GEMINI3_BASELINE",
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

    const instantOutput = makeOutput({ temperature: 1.0, topP: 0.95 })
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

  const nonThinkingOutput = makeOutput({ temperature: 1.0, topP: 0.95 })
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
  assert.equal(nonThinkingOutput.temperature, 1.0)
  assert.equal(nonThinkingOutput.topP, 0.95)
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

test("applies Qwen3.x family sampling values when fields are absent", () => {
  for (const modelID of ["qwen3.5", "qwen3.7-max", "qwen3.8-max", "qwen3-coder"]) {
    for (const modelOptions of [{ reasoningEffort: "high" }, { thinking: { type: "disabled" } }]) {
      const output = makeOutput()
      assert.equal(applyProfile(makeModel(modelID, { modelOptions }), output), true)
      assert.equal(output.temperature, 1.0)
      assert.equal(output.topP, 0.95)
      assert.equal(output.topK, undefined)
    }
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

test("keeps the legacy Gemini environment overrides", () => {
  process.env.OPENCODE_GEMINI3_TEMPERATURE = "0.42"
  process.env.OPENCODE_GEMINI3_BASELINE = "1"

  const output = makeOutput({ temperature: 1 })
  const model = makeModel("gemini-3-pro", { provider: "google" })
  assert.equal(applyProfile(model, output), true)
  assert.equal(output.temperature, 0.42)
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
