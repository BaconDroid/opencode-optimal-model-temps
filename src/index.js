import { Plugin } from "@opencode/plugin"

import { SAMPLING_PROFILES } from "./profiles.js"

export const PLUGIN_ID = "opencode-optimal-model-temps"

const FIELD_NAMES = Object.freeze({
  temperature: "temperature",
  topP: "topP",
  topK: "topK",
})

const SAMPLING_FIELDS = Object.freeze(Object.keys(FIELD_NAMES))

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

function modelIdAliases(id) {
  const slash = id.lastIndexOf("/")
  return slash === -1 ? [id] : [id, id.slice(slash + 1)]
}

// V2 exposes both the catalog id and the upstream model id; either may carry the family name.
function modelIds(model) {
  const ids = [model?.modelID, model?.api?.id]
    .filter((value) => typeof value === "string" && value.length > 0)
    .map((value) => value.toLowerCase())
  return [...new Set(ids)]
}

function findProfile(model) {
  const provider = providerId(model)
  const ids = modelIds(model)
  if (!ids.length) return undefined

  // Hosted gateways namespace ids as "<vendor>/<model>" (e.g. "z-ai/glm-5.3-flash").
  // Match both the full id and the vendor-stripped basename.
  const aliases = [...new Set(ids.flatMap(modelIdAliases))]
  const matches = SAMPLING_PROFILES.filter((profile) => {
    if (profile.providers && !profile.providers.some((allowed) => allowed.toLowerCase() === provider)) return false
    return aliases.some((candidate) => profile.match.test(candidate))
  })

  // A model-specific rule (scope: "model") takes precedence; family rules are a fallback only.
  return matches.find((profile) => profile.scope === "model") ?? matches.find((profile) => profile.scope !== "model")
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

function isUnsetValue(value) {
  return value === undefined || value === null
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

// Both the field and the mode paths walk the same highest-first order, so a field's value and
// the mode are always read from the sources under one precedence rule.
function rankedSources(sourceList) {
  return [...sourceList].reverse()
}

// The highest source that defines the field wins. A present key whose value is `undefined`
// does not define it, so a lower layer's defined value is not erased by an empty higher layer.
// `null` still counts as defined here; profile filling treats it as unset (V1 parity).
function highestDefined(ranked, field) {
  for (const source of ranked) {
    if (source === null || typeof source !== "object" || Array.isArray(source)) continue
    const value = source[field]
    if (value !== undefined) return value
  }
  return undefined
}

// The selected variant refines its model, so it takes precedence over model settings.
// Agent request settings take precedence over both.
function variantSettings(ref, modelInfo) {
  if (!ref?.variant || !Array.isArray(modelInfo?.variants)) return undefined
  return modelInfo.variants.find((variant) => variant?.id === ref.variant)?.settings
}

// Rebuild the V1 `chat.params` model shape from V2 refs so the profile registry
// can match it. V2 `ModelCapabilities` exposes only `tools`, `input`, and `output`;
// there is no temperature capability signal, so no capability is fabricated here
// (the V1 guard still applies to V1-shaped models).
function modelFromV2(ref, modelInfo) {
  return {
    providerID: ref?.providerID ?? modelInfo?.providerID ?? "",
    modelID: modelInfo?.modelID ?? ref?.id ?? "",
    api: {
      id: modelInfo?.id ?? ref?.id ?? "",
    },
  }
}

// V2 precedence, highest wins: event.options (including earlier hooks) > agent request
// settings > selected variant settings > model settings. This is the one place the order
// is declared, ascending. `rankedSources` reverses it for both field values and mode
// detection rather than either path restating the order.
function sources(event, modelInfo, agentInfo) {
  return [modelInfo?.settings, variantSettings(event?.model, modelInfo), agentInfo?.request?.settings, event?.options]
}

function detectModeFromSources(sourceList) {
  const forced = normalizeMode(process.env.OPENCODE_SAMPLING_MODE)
  if (forced) return forced

  for (const source of sourceList) {
    const found = detectModeFromValue(source)
    if (found) return found
  }

  return undefined
}

function selectModeFromSources(profile, sourceList) {
  const mode = detectModeFromSources(sourceList) ?? "nonThinking"
  if (profile.modes[mode]) return mode
  if (profile.modes.any) return "any"
  return mode
}

const UNRESOLVED = Symbol("unresolved")

/**
 * Apply the sampled profile to a V2 session `context` hook event.
 *
 * Fields set to a non-null value in `event.options` (including earlier hooks) are treated as
 * explicit and never overwritten; a present-but-`undefined` key does not hide a lower layer's
 * defined value, and `null` is treated as unset (V1 parity). Agent request `settings` take
 * precedence over the selected variant's `settings`, which take precedence over model
 * `settings`. The hook has been observed to arrive with some options prepopulated, so the
 * plugin only fills fields it can prove are unset.
 *
 * When the model record cannot be resolved for a reference that matches a profile, nothing is
 * written: an unknown field cannot be told apart from a user-configured one.
 */
export function applyRequestProfile(event, modelInfo, agentInfo, onSkip) {
  const options = event?.options
  if (!options || typeof options !== "object") return false

  const sourceList = sources(event, modelInfo, agentInfo)
  const ranked = rankedSources(sourceList)
  const model = modelFromV2(event?.model, modelInfo)
  const profile = resolveProfile(findProfile(model))
  if (!profile) return false

  if (!modelInfo) {
    onSkip?.("model-info-unavailable")
    return false
  }

  if (agentInfo === UNRESOLVED) {
    onSkip?.("agent-info-unavailable")
    return false
  }

  const mode = selectModeFromSources(profile, ranked)
  const values = profile.modes[mode]
  if (!values) return false

  let changed = false
  for (const field of SAMPLING_FIELDS) {
    if (!isUnsetValue(highestDefined(ranked, field))) continue
    if (!canApplyField(model, profile, field, values[field])) continue
    options[field] = values[field]
    changed = true
  }

  return changed
}

const MODEL_CACHE_TTL_MS = 5 * 60 * 1000
const RETRY_TTL_MS = 30 * 1000
const AGENT_CACHE_TTL_MS = 5 * 60 * 1000

function cacheKey(providerID, id) {
  return `${providerID ?? ""}\u0000${id ?? ""}`
}

// A model record may expose the route provider (`providerID`) or the upstream provider
// (`canonical`); either may equal the request reference's provider. Match the id
// case-insensitively, then rank: an exact `providerID` wins over a `canonical` match (the
// first canonical match wins when several match). Only a reference without a requested
// provider falls back to the first candidate; a requested provider matching neither field is
// unresolved, so the caller fails closed rather than borrowing another provider's record.
// `model.list()` order is unspecified, so accepting the first fuzzy match can read a
// different provider's record.
function selectModelRecord(list, ref) {
  if (!ref?.id) return undefined

  const id = String(ref.id).toLowerCase()
  const candidates = list.filter(
    (model) => String(model?.id ?? "").toLowerCase() === id || String(model?.modelID ?? "").toLowerCase() === id,
  )
  if (!candidates.length) return undefined

  const provider = String(ref.providerID ?? "").toLowerCase()
  if (!provider) return candidates[0]

  return (
    candidates.find((model) => String(model?.providerID ?? "").toLowerCase() === provider) ??
    candidates.find((model) => String(model?.canonical ?? "").toLowerCase() === provider) ??
    undefined
  )
}

async function watchUpdates(ctx, signal, invalidate) {
  if (typeof ctx.event?.subscribe !== "function") return
  try {
    for await (const item of ctx.event.subscribe({ signal })) {
      if (item?.type === "model.updated" || item?.type === "agent.updated") invalidate()
    }
  } catch {
    // The subscription ended or was aborted; TTLs keep cached entries fresh either way.
  }
}

function createResolver(ctx) {
  const models = new Map()
  const agents = new Map()
  const warned = new Set()

  async function modelInfo(ref) {
    if (!ref?.id) return undefined
    const key = cacheKey(ref.providerID, ref.id)
    const cached = models.get(key)
    if (cached && cached.expires > Date.now()) return cached.value

    let value
    try {
      const result = await ctx.model.list()
      const list = Array.isArray(result) ? result : (result?.data ?? [])
      value = selectModelRecord(list, ref)
    } catch {
      value = undefined
    }

    models.set(key, { value, expires: Date.now() + (value ? MODEL_CACHE_TTL_MS : RETRY_TTL_MS) })
    return value
  }

  async function agentInfo(agentID) {
    if (!agentID) return undefined
    const cached = agents.get(agentID)
    if (cached && cached.expires > Date.now()) return cached.value

    let value
    try {
      const result = await ctx.agent.get({ agentID })
      // V2 `agent.get` returns `{ location, data }`; tolerate older/unwrapped shapes.
      if (result?.data != null) value = result.data
      else if (result?.id != null) value = result
      else value = UNRESOLVED
    } catch {
      value = UNRESOLVED
    }

    const ttl = value === UNRESOLVED ? RETRY_TTL_MS : AGENT_CACHE_TTL_MS
    agents.set(agentID, { value, expires: Date.now() + ttl })
    return value
  }

  function warnSkip(ref, reason) {
    const key = `${cacheKey(ref?.providerID, ref?.id)}:${reason}`
    if (warned.has(key)) return
    warned.add(key)
    console.warn(
      `[opencode-optimal-model-temps] skipped profile (${reason}) for ${ref?.providerID ?? "?"}/${ref?.id ?? "?"}`,
    )
  }

  function invalidate() {
    models.clear()
    agents.clear()
    warned.clear()
  }

  return { modelInfo, agentInfo, warnSkip, invalidate }
}

export const OptimalModelTemperaturesPlugin = async () => ({
  "chat.params": async ({ model }, output) => {
    applyProfile(model, output)
  },
})

export default {
  ...Plugin.define({
    id: PLUGIN_ID,
    async setup(ctx) {
      const resolver = createResolver(ctx)
      const abort = new AbortController()
      void watchUpdates(ctx, abort.signal, resolver.invalidate)

      await ctx.session.hook("context", async (event) => {
        try {
          const [modelInfo, agentInfo] = await Promise.all([
            resolver.modelInfo(event?.model),
            resolver.agentInfo(event?.agent),
          ])
          applyRequestProfile(event, modelInfo, agentInfo, (reason) => resolver.warnSkip(event?.model, reason))
        } catch (error) {
          // A sampling plugin must never fail a chat request.
          const detail = error instanceof Error ? error.message : String(error)
          resolver.warnSkip(event?.model, `hook-error: ${detail}`)
        }
      })

      return () => abort.abort()
    },
  }),
  // V1 entrypoint, kept so the package still loads under OpenCode 1.18.29+.
  async server() {
    return OptimalModelTemperaturesPlugin()
  },
}
