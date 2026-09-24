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
  assert.equal(detectSamplingMode(makeModel("kimi-k2.6"), makeOutput()), undefined)
})

test("applies separate thinking and non-thinking Kimi K2.6 profiles", () => {
  const thinkingOutput = makeOutput()
  assert.equal(
    applyProfile(
      makeModel("kimi-k2.6", { modelOptions: { reasoningEffort: "high" } }),
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
      makeModel("kimi-k2.6", { modelOptions: { enable_thinking: false } }),
      instantOutput,
    ),
    true,
  )
  assert.equal(instantOutput.temperature, 0.6)
  assert.equal(instantOutput.topP, 0.95)
  assert.equal(instantOutput.topK, undefined)
})

test("does not guess a mode for a two-mode profile", () => {
  const output = makeOutput()
  assert.equal(applyProfile(makeModel("minimax-m3"), output), false)
  assert.equal(output.temperature, undefined)
  assert.equal(output.topP, undefined)
})

test("does not guess a mode for the MiniMax family", () => {
  for (const modelID of ["minimax-m2", "minimax-m2.5", "minimax-m2.7", "minimax-m3"]) {
    const output = makeOutput()
    assert.equal(applyProfile(makeModel(modelID), output), false)
    assert.equal(output.temperature, undefined)
    assert.equal(output.topP, undefined)
  }
})

test("applies separate GLM-5 hybrid profiles outside OpenCode Go", () => {
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

test("keeps GLM-5.3 thinking-only on every route", () => {
  for (const provider of ["test-provider", "opencode-go"]) {
    const thinkingOutput = makeOutput()
    assert.equal(
      applyProfile(
        makeModel("glm-5.3", {
          provider,
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
        makeModel("glm-5.3", {
          provider,
          modelOptions: { thinking: { type: "disabled" } },
        }),
        nonThinkingOutput,
      ),
      false,
    )
    assert.equal(nonThinkingOutput.temperature, undefined)
  }
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

test("applies Qwen Max sampling values when fields are absent", () => {
  for (const modelID of ["qwen3.7-max", "qwen3.8-max"]) {
    for (const modelOptions of [{ reasoningEffort: "high" }, { thinking: { type: "disabled" } }]) {
      const output = makeOutput()
      assert.equal(applyProfile(makeModel(modelID, { modelOptions }), output), true)
      assert.equal(output.temperature, 1.0)
      assert.equal(output.topP, 0.95)
      assert.equal(output.topK, undefined)
    }
  }
})

test("applies DeepSeek V4 values in both modes", () => {
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

test("applies Kimi K3 non-thinking values on the Go route", () => {
  const output = makeOutput()
  assert.equal(
    applyProfile(
      makeModel("kimi-k3", {
        provider: "opencode-go",
        modelOptions: { thinking: { type: "disabled" } },
      }),
      output,
    ),
    true,
  )
  assert.equal(output.temperature, 0.6)
  assert.equal(output.topP, 0.95)
})

test("applies the MiniMax family values", () => {
  for (const modelID of ["minimax-m2", "minimax-m2.5", "minimax-m2.7", "minimax-m3"]) {
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
    assert.equal(nonThinkingOutput.temperature, 0.1)
    assert.equal(nonThinkingOutput.topP, 0.95)
  }
})

test("splits MiMo V2.5 and V2 Flash presets", () => {
  const cases = [
    ["mimo-v2.5", 1.0, 0.7],
    ["mimo-v2-flash", 0.3, 0.8],
  ]

  for (const [modelID, thinkingTemperature, nonThinkingTemperature] of cases) {
    const thinkingOutput = makeOutput()
    assert.equal(
      applyProfile(
        makeModel(modelID, { modelOptions: { reasoningEffort: "high" } }),
        thinkingOutput,
      ),
      true,
    )
    assert.equal(thinkingOutput.temperature, thinkingTemperature)
    assert.equal(thinkingOutput.topP, 0.95)

    const nonThinkingOutput = makeOutput()
    assert.equal(
      applyProfile(
        makeModel(modelID, { modelOptions: { thinking: { type: "disabled" } } }),
        nonThinkingOutput,
      ),
      true,
    )
    assert.equal(nonThinkingOutput.temperature, nonThinkingTemperature)
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

test("applies the Go-compatible Kimi sampling values", () => {
  for (const modelID of ["kimi-k3", "kimi-k2.7-code"]) {
    const output = makeOutput()
    const model = makeModel(modelID, { provider: "opencode-go" })
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
