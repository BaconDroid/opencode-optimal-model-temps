import { SAMPLING_PROFILES } from "./profiles.js"

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
  1: "thinking",
  true: "thinking",
  enable: "thinking",
  on: "thinking",
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

const FALLBACK_MODE_KEYS = new Set([
  "thinking",
  "thinking_config",
  "thinking_configuration",
  "thinkingconfig",
  "reasoning",
  "reasoning_config",
  "reasoningconfig",
  "enable_thinking",
  "enablethinking",
  "thinking_mode",
  "thinkingmode",
  "reasoning_effort",
  "reasoningeffort",
  "reasoning_mode",
  "reasoningmode",
  "effort",
  "think",
  "type",
  "status",
  "mode",
  "level",
])

function isEmptyModeValue(value) {
  if (value == null) return true
  if (typeof value === "string") return value.trim().length === 0
  if (typeof value === "number") return value === 0
  if (typeof value === "boolean") return value === false
  if (Array.isArray(value)) return value.length === 0
  if (typeof value === "object") return Object.values(value).every(isEmptyModeValue)
  return false
}

function normalizeKey(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "")
}

function normalizeMode(value) {
  if (typeof value === "boolean") return value ? "thinking" : "nonThinking"
  if (typeof value === "number") {
    if (value === 1) return "thinking"
    if (value === 0) return "nonThinking"
    return undefined
  }
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
    const mode = normalizeMode(value)
    if (mode) return mode
    if (value !== null && typeof value === "object") return undefined
    if (value === undefined) return "thinking"
    if (FALLBACK_MODE_KEYS.has(key) && !isEmptyModeValue(value)) return "thinking"
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
    if (FALLBACK_MODE_KEYS.has(normalizeKey(parentKey)) && value.length > 0) return "thinking"
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

  if (FALLBACK_MODE_KEYS.has(normalizeKey(parentKey)) && !isEmptyModeValue(value)) return "thinking"
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

  if (temperature !== undefined) {
    for (const values of Object.values(resolved.modes)) {
      if (values.temperature !== undefined) values.temperature = temperature
    }
  }

  return resolved
}

function selectMode(profile, model, output) {
  const mode = detectExplicitMode(model, output) ?? "nonThinking"
  if (profile.modes[mode]) return mode
  if (profile.modes.any) return "any"
  return mode
}

function isUnsetValue(current) {
  return current === undefined || current === null
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

    if (!isUnsetValue(output[outputField])) continue

    output[outputField] = target
    changed = true
  }

  return changed
}

export function detectSamplingMode(model, output) {
  return detectExplicitMode(model, output) ?? "nonThinking"
}

export const OptimalModelTemperaturesPlugin = async () => ({
  "chat.params": async ({ model }, output) => {
    applyProfile(model, output)
  },
})
