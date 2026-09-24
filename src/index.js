import { SAMPLING_PROFILES } from "./profiles.js"

const VALUE_EPSILON = 1e-3

const FIELD_NAMES = Object.freeze({
  temperature: "temperature",
  topP: "topP",
  topK: "topK",
})

const MODE_ALIASES = Object.freeze({
  thinking: "thinking",
  think: "thinking",
  reasoning: "thinking",
  enabled: "thinking",
  enable: "thinking",
  on: "thinking",
  adaptive: "thinking",
  always: "thinking",
  low: "thinking",
  medium: "thinking",
  high: "thinking",
  max: "thinking",
  xhigh: "thinking",
  nonthinking: "nonThinking",
  "non-thinking": "nonThinking",
  instant: "nonThinking",
  disabled: "nonThinking",
  disable: "nonThinking",
  off: "nonThinking",
  none: "nonThinking",
  false: "nonThinking",
  "0": "nonThinking",
})

const MODE_CONTAINER_KEYS = new Set([
  "chattemplatekwargs",
  "thinking",
  "thinking_config",
  "thinking_configuration",
  "thinkingconfig",
  "reasoning",
  "reasoning_config",
  "reasoningconfig",
])

const MODE_SCALAR_KEYS = new Set([
  "enable_thinking",
  "enablethinking",
  "thinking",
  "thinking_mode",
  "thinkingmode",
  "reasoning",
  "reasoning_effort",
  "reasoningeffort",
  "reasoning_mode",
  "reasoningmode",
  "effort",
  "think",
])

function normalizeKey(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "")
}

function normalizeMode(value) {
  if (typeof value === "boolean") return value ? "thinking" : "nonThinking"
  if (typeof value !== "string") return undefined
  return MODE_ALIASES[normalizeKey(value)]
}

function modelId(model) {
  return String(model?.modelID ?? model?.api?.id ?? "").toLowerCase()
}

function providerId(model) {
  return String(model?.providerID ?? model?.provider ?? "").toLowerCase()
}

function modeFromScalar(value, parentKey) {
  const key = normalizeKey(parentKey)
  if (MODE_SCALAR_KEYS.has(key) || key === "type" || key === "status" || key === "mode" || key === "level") {
    return normalizeMode(value)
  }
  return undefined
}

function detectModeFromValue(value, parentKey = "", depth = 0) {
  if (depth > 5 || value == null) return undefined

  if (typeof value !== "object") {
    return modeFromScalar(value, parentKey)
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const found = detectModeFromValue(item, parentKey, depth + 1)
      if (found) return found
    }
    return undefined
  }

  for (const [key, child] of Object.entries(value)) {
    const normalized = normalizeKey(key)
    const direct = modeFromScalar(child, normalized)
    if (direct) return direct

    if (MODE_CONTAINER_KEYS.has(normalized)) {
      const nested = detectModeFromValue(child, normalized, depth + 1)
      if (nested) return nested
    }
  }

  return undefined
}

function detectExplicitMode(model, output) {
  const forced = normalizeMode(process.env.OPENCODE_SAMPLING_MODE)
  if (forced) return forced

  for (const source of [output?.options, model?.options, model?.api?.options]) {
    const found = detectModeFromValue(source)
    if (found) return found
  }

  return undefined
}

function findProfile(model) {
  const provider = providerId(model)
  const id = modelId(model)
  if (!id) return undefined

  return SAMPLING_PROFILES.find((profile) => {
    if (profile.providers && !profile.providers.some((allowed) => allowed.toLowerCase() === provider)) return false
    return profile.match.test(id)
  })
}

function readNumericEnv(name) {
  if (!name || process.env[name] === undefined) return undefined
  const value = Number(process.env[name])
  return Number.isFinite(value) ? value : undefined
}

function resolveProfile(profile) {
  if (!profile?.env) return profile

  const resolved = {
    ...profile,
    modes: Object.fromEntries(Object.entries(profile.modes).map(([mode, values]) => [mode, { ...values }])),
  }
  const temperature = readNumericEnv(profile.env.temperature)
  const baseline = readNumericEnv(profile.env.baseline)

  if (temperature !== undefined) {
    for (const values of Object.values(resolved.modes)) {
      if (values.temperature !== undefined) values.temperature = temperature
    }
  }
  if (baseline !== undefined) {
    resolved.baselines = { ...resolved.baselines, temperature: baseline }
  }

  return resolved
}

function selectMode(profile, model, output) {
  const explicit = detectExplicitMode(model, output)
  if (explicit) {
    if (profile.alwaysThinking && explicit === "nonThinking") return undefined
    if (profile.modes[explicit]) return explicit
  }

  if (profile.alwaysThinking) return profile.defaultMode ?? "thinking"
  if (profile.defaultMode && profile.modes[profile.defaultMode]) return profile.defaultMode
  if (profile.modes.any) return "any"
  return undefined
}

function isDefaultValue(current, baseline) {
  if (current === undefined || current === null) return true
  if (baseline === undefined || !Number.isFinite(baseline)) return false
  return typeof current === "number" && Math.abs(current - baseline) < VALUE_EPSILON
}

function canApplyField(model, profile, field, value) {
  if (!Number.isFinite(value)) return false
  if (field === "temperature" && model?.capabilities?.temperature === false) return false
  if (profile.unsupported?.includes(field)) return false
  return true
}

export function applyProfile(model, output) {
  const profile = resolveProfile(findProfile(model))
  if (!profile) return false

  const mode = selectMode(profile, model, output)
  if (!mode) return false

  const values = profile.modes[mode]
  if (!values) return false

  let changed = false
  for (const [field, outputField] of Object.entries(FIELD_NAMES)) {
    const target = values[field]
    if (!canApplyField(model, profile, field, target)) continue

    const baseline = profile.baselines?.[outputField]
    if (!isDefaultValue(output[outputField], baseline)) continue

    output[outputField] = target
    changed = true
  }

  return changed
}

export function detectSamplingMode(model, output) {
  return detectExplicitMode(model, output)
}

export const OptimalModelTemperaturesPlugin = async () => ({
  "chat.params": async ({ model }, output) => {
    applyProfile(model, output)
  },
})
