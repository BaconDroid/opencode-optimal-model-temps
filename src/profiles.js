export const EVIDENCE_LEVELS = Object.freeze({
  A: "exact official source plus independent verification",
  B: "exact official source; independent verification is not available",
  C: "proxy, sibling model, or fixed benchmark condition; not auto-applied",
  D: "community or legacy heuristic; retained only for compatibility",
})

const official = (id, url, note) => ({ id, url, kind: "official", note })
const independent = (id, url, note) => ({ id, url, kind: "independent", note })
const community = (id, url, note) => ({ id, url, kind: "community", note })

const thinking = (temperature, topP, topK = undefined) => ({
  temperature,
  topP,
  topK,
})

const nonThinking = (temperature, topP, topK = undefined) => ({
  temperature,
  topP,
  topK,
})

// `scope: "model"` marks a model- or route-specific rule. The resolver applies the first
// matching model-scope rule and only falls back to family-scope rules (entries without a
// `scope`) when no model-scope rule matches. Family entries therefore do not need to be
// ordered after model entries.
export const SAMPLING_PROFILES = Object.freeze([
  {
    id: "gemini-3-pro",
    scope: "model",
    match: /gemini-3-pro/,
    providers: ["google"],
    modes: {
      thinking: thinking(0.35),
      nonThinking: thinking(0.35),
      any: thinking(0.35),
    },
    env: {
      temperature: "OPENCODE_GEMINI3_TEMPERATURE",
    },
    evidence: "D",
    sources: [
      community(
        "lynchmark-gemini-temperature",
        "https://lynchmark.com/blog/gemini-optimal-temperature",
        "Community benchmark used by the original plugin; not an OpenCode or Google default.",
      ),
      community(
        "original-plugin",
        "https://github.com/Lyapsus/opencode-optimal-model-temps",
        "Original implementation and compatibility behavior.",
      ),
    ],
  },
  {
    id: "glm-5-opencode-go",
    scope: "model",
    match: /^glm-5(?:$|[-.])/,
    providers: ["opencode-go"],
    modes: {
      thinking: thinking(1.0),
    },
    evidence: "B",
    sources: [
      official(
        "glm-5.2-guide",
        "https://docs.z.ai/guides/llm/glm-5.2.md",
        "Official GLM-5.2 examples use temperature 1.0 with thinking and 0.6 without thinking.",
      ),
      official(
        "glm-5.3-guide",
        "https://docs.z.ai/guides/llm/glm-5.3.md",
        "Official GLM-5.3 documentation requires thinking and uses temperature 1.0 in its examples.",
      ),
    ],
  },
  {
    id: "glm-5-family",
    match: /^glm-5(?:$|[-.])/,
    modes: {
      thinking: thinking(1.0),
      nonThinking: nonThinking(0.6),
    },
    evidence: "B",
    sources: [
      official(
        "glm-5.2-guide",
        "https://docs.z.ai/guides/llm/glm-5.2.md",
        "Official GLM-5 family guidance uses temperature 1.0 for thinking and 0.6 for non-thinking examples.",
      ),
    ],
  },
  {
    id: "qwen3.5-family",
    scope: "model",
    match: /^qwen3\.5(?:$|[-.])/,
    modes: {
      thinking: thinking(0.6, 0.95),
      nonThinking: nonThinking(0.7, 0.8),
    },
    evidence: "B",
    sources: [
      official(
        "qwen3.5-397b-card",
        "https://huggingface.co/Qwen/Qwen3.5-397B-A17B",
        "Official Qwen3.5 card: thinking mode temperature=0.6, top_p=0.95, top_k=20; instruct/non-thinking temperature=0.7, top_p=0.8, top_k=20. Qwen3.5 uses thinking temperature 0.6, unlike the later Qwen3.6/3.8 generation at 1.0, so it is a model-specific exception.",
      ),
    ],
  },
  {
    id: "qwen3.8-max",
    scope: "model",
    match: /^qwen3\.8-max(?:$|[-.])/,
    modes: {
      thinking: thinking(1.0, 0.95),
      nonThinking: nonThinking(1.0, 0.95),
    },
    evidence: "B",
    sources: [
      official(
        "qwen3.8-2.4t-card",
        "https://huggingface.co/Qwen/Qwen3.8-2.4T-A95B",
        "Official Qwen3.8-2.4T-A95B card requires thinking mode for all interactions (thinking cannot be disabled) and lists temperature=1.0, top_p=0.95, top_k=20. Because the model is thinking-only, the same values are reused for the non-thinking slot without changing the provider mode.",
      ),
      independent(
        "qwen3.8-max-sampling-card",
        "https://github.com/xbtlin/ai-berkshire/blob/836f0bf51ffa8f30c22bf730255ab8d64de56b91/reports/%E5%A4%A7%E6%A8%A1%E5%9E%8B%E5%85%A8%E6%99%AF%E5%AF%B9%E6%AF%94-20260906/evidence/Qwen__Qwen3.8-2.4T-A95B__README.md",
        "Archived copy of the Qwen3.8-2.4T-A95B card records the same temperature 1.0, top_p 0.95, and top_k 20 for the thinking-only model.",
      ),
    ],
  },
  {
    id: "qwen3-family",
    match: /^qwen3(?:$|[-.])/,
    modes: {
      thinking: thinking(1.0, 0.95),
      nonThinking: nonThinking(0.7, 0.8),
    },
    evidence: "B",
    sources: [
      official(
        "qwen3.6-27b-card",
        "https://huggingface.co/Qwen/Qwen3.6-27B",
        "Official Qwen3.6 card: thinking mode for general tasks temperature=1.0, top_p=0.95, top_k=20 (precise-coding tasks use 0.6); instruct/non-thinking temperature=0.7, top_p=0.80, top_k=20.",
      ),
      official(
        "qwen3.8-27b-card",
        "https://huggingface.co/Qwen/Qwen3.8-27B",
        "Official Qwen3.8-27B card and generation_config.json give thinking temperature=1.0, top_p=0.95, top_k=20 and instruct/non-thinking temperature=0.7, top_p=0.80, top_k=20.",
      ),
      official(
        "qwen3.8-flash-next-card",
        "https://huggingface.co/Qwen/Qwen3.8-Flash-Next-FP8",
        "Official Qwen3.8-Flash-Next card repeats the same mode split: thinking 1.0/0.95/20, non-thinking 0.7/0.80/20.",
      ),
    ],
  },
  {
    id: "deepseek-v4-family",
    match: /^deepseek-v4(?:$|[-.])/,
    modes: {
      thinking: thinking(1.0, 1.0),
      nonThinking: nonThinking(1.0, 1.0),
    },
    evidence: "A",
    sources: [
      official(
        "deepseek-v4-blog",
        "https://huggingface.co/blog/deepseekv4",
        "DeepSeek V4 benchmark guidance uses temperature 1.0 and top_p 1.0; direct Go probes accepted both fields in thinking and non-thinking modes, while the upstream documentation says thinking may ignore them semantically.",
      ),
      independent(
        "nvidia-nim-deepseek-v4",
        "https://docs.nvidia.com/nim/large-language-models/latest/get-started/advanced/get-started-deepseek-v4-pro-0813.html",
        "Independent NVIDIA NIM documentation confirms the checkpoint defaults temperature=1.0 and top_p=1.0, and adds a workload caveat: for agentic workloads it states that DeepSeek recommends top_p=0.95. The family keeps 1.0 pending a decision on that caveat.",
      ),
    ],
  },
  {
    id: "kimi-k2.7-code",
    scope: "model",
    match: /^kimi-k2\.7-code(?:$|[-.])/,
    modes: {
      thinking: thinking(1.0, 0.95),
    },
    evidence: "B",
    sources: [
      official(
        "kimi-k2.7-code-quickstart",
        "https://platform.kimi.ai/docs/guide/kimi-k2-7-code-quickstart",
        "Official K2.7 Code quickstart fixes temperature at 1.0 and top_p at 0.95 and states the model errors if thinking is disabled, so this rule is thinking-only on every provider and never fills the non-thinking slot.",
      ),
      independent(
        "kimi-k2.7-opencode-constraints",
        "https://github.com/langgenius/dify-official-plugins/blob/f6b4a6a945b4e5909d7c9ceb4c593505f1a3238d/models/opencode-go/models/llm/llm.py",
        "Independent OpenCode Go provider forces temperature 1 and top_p 0.95 for K2.7 Code, consistent with the model-wide thinking-only constraint.",
      ),
    ],
  },
  {
    id: "kimi-k2-family",
    match: /^kimi-k2(?:\.[0-9]+)?(?:$|[-.])/,
    modes: {
      thinking: thinking(1.0, 0.95),
      nonThinking: nonThinking(0.6, 0.95),
    },
    evidence: "A",
    sources: [
      official(
        "kimi-k2.6-quickstart",
        "https://platform.kimi.ai/docs/guide/kimi-k2-6-quickstart",
        "Official Kimi K2.6 guidance distinguishes thinking temperature 1.0 from instant temperature 0.6.",
      ),
      official(
        "kimi-k2.7-code-quickstart",
        "https://platform.kimi.ai/docs/guide/kimi-k2-7-code-quickstart",
        "Official K2.7 Code guidance is used as K2.x family context; the Go route has a separate thinking-only safety override.",
      ),
      independent(
        "dell-kimi-k2.6-card",
        "https://dell.huggingface.co/models/moonshotai/Kimi-K2.6",
        "Independent Dell Enterprise Hub card reproduces the K2.6 values: temperature 1.0 for Thinking mode, 0.6 for Instant mode, and top_p 0.95.",
      ),
    ],
  },
  {
    id: "kimi-k3-family",
    match: /^kimi-k3(?:\.[0-9]+)?(?:$|[-.])/,
    modes: {
      thinking: thinking(1.0, 0.95),
      nonThinking: nonThinking(0.6, 0.95),
    },
    evidence: "B",
    sources: [
      official(
        "kimi-k3-readme",
        "https://github.com/MoonshotAI/Kimi-K3",
        "Official Kimi K3 benchmark conditions use temperature 1.0 with top_p 0.95 for single-step tasks and top_p 1.0 for agentic tasks; the family keeps 0.95 (the API-fixed value) and does not adopt the agentic benchmark top_p.",
      ),
    ],
  },
  {
    id: "minimax-m2-family",
    match: /^minimax-m2(?:$|[-.])/,
    modes: {
      thinking: thinking(1.0, 0.95),
      nonThinking: nonThinking(1.0, 0.95),
    },
    evidence: "B",
    sources: [
      official(
        "minimax-m2-readme",
        "https://github.com/MiniMax-AI/MiniMax-M2",
        "Official M2 guidance recommends temperature 1.0 and top_p 0.95; the model uses interleaved thinking.",
      ),
      official(
        "minimax-m2.1-readme",
        "https://github.com/MiniMax-AI/MiniMax-M2.1",
        "Official M2.1 guidance recommends temperature 1.0 and top_p 0.95.",
      ),
      official(
        "minimax-m2.5-readme",
        "https://github.com/MiniMax-AI/MiniMax-M2.5",
        "Official M2.5 guidance recommends temperature 1.0 and top_p 0.95.",
      ),
      official(
        "minimax-m2.7-readme",
        "https://github.com/MiniMax-AI/MiniMax-M2.7",
        "Official M2.7 guidance recommends temperature 1.0 and top_p 0.95.",
      ),
      official(
        "minimax-anthropic-api",
        "https://platform.minimax.io/docs/api-reference/text-anthropic-api",
        "Official hosted API documentation states that thinking cannot be disabled for M2.x models and lists a 0.9 top_p default; the model cards recommend 0.95. The family reuses the same sampling values for a non-thinking slot without changing the provider mode.",
      ),
    ],
  },
  {
    id: "minimax-m3-family",
    match: /^minimax-m3(?:$|[-.])/,
    modes: {
      thinking: thinking(1.0, 0.95),
      nonThinking: nonThinking(1.0, 0.95),
    },
    evidence: "B",
    sources: [
      official(
        "minimax-m3-readme",
        "https://github.com/MiniMax-AI/MiniMax-M3",
        "Official M3 guidance recommends temperature 1.0 and top_p 0.95 and documents enabled, adaptive, and disabled reasoning modes.",
      ),
      official(
        "minimax-openai-api",
        "https://platform.minimax.io/docs/api-reference/text-openai-api",
        "Official hosted API documentation exposes adaptive and disabled thinking for M3. The OpenCode Go route has reported enabled rejections; the plugin classifies enabled, true, and other non-empty mode values as thinking but never rewrites the field.",
      ),
    ],
  },
  {
    id: "mimo-v2-family",
    match: /^mimo-v2(?:$|[-.])/,
    modes: {
      thinking: thinking(1.0, 0.95),
      nonThinking: nonThinking(1.0, 0.95),
    },
    evidence: "B",
    sources: [
      independent(
        "mimo-v2.5-pro-recipe",
        "https://github.com/sgl-project/sglang-jax/blob/11248f5adbd3633a4b21bbc8af01483edd727bfd/docs/cookbook/autoregressive/Xiaomi/MiMo-V2.5-Pro.md",
        "The recipe documents temperature 1.0 and top_p 0.95 for thinking-on. The same family values are applied to both modes by user policy; task-specific tool-calling values are not used.",
      ),
      official(
        "mimo-v2-flash-readme",
        "https://github.com/XiaomiMiMo/MiMo-V2-Flash/blob/b4eaae40d3728657ff7f0f9397dcce3c9ab3d3b7/README.md",
        "Official MiMo-V2-Flash guidance uses top_p 0.95 and task-specific temperatures; those task values are not used as separate mode profiles.",
      ),
    ],
  },
  {
    id: "grok-4-family",
    match: /^grok-4(?:$|\.)/,
    modes: {
      thinking: thinking(0.7, 0.95),
      nonThinking: nonThinking(0.7, 0.95),
    },
    evidence: "B",
    sources: [
      official(
        "xai-best-practices",
        "https://docs.x.ai/developers/model-capabilities/text/best-practices",
        "Official xAI best-practices guide recommends temperature 0.7 and top_p 0.95 for Grok text and reasoning models and warns that quality drops far from these values. The guide does not distinguish reasoning from non-reasoning, so both modes use the same values.",
      ),
      official(
        "xai-build-settings",
        "https://docs.x.ai/build/settings.md",
        "xAI's own Grok Build default configuration ships temperature 0.7 and top_p 0.95 for grok-4.7, matching the best-practices recommendation.",
      ),
    ],
  },
  {
    id: "grok-build",
    scope: "model",
    match: /^grok-build/,
    modes: {
      thinking: thinking(0.7, 0.95),
      nonThinking: nonThinking(0.7, 0.95),
    },
    evidence: "B",
    sources: [
      official(
        "xai-best-practices",
        "https://docs.x.ai/developers/model-capabilities/text/best-practices",
        "Official xAI best-practices guide recommends temperature 0.7 and top_p 0.95 for Grok models; grok-build has no separate published value, so the generic Grok recommendation is reused.",
      ),
    ],
  },
  {
    id: "hy3-family",
    match: /^hy3(?:$|[-.])/,
    modes: {
      thinking: thinking(0.9, 1.0),
      nonThinking: nonThinking(0.9, 1.0),
    },
    evidence: "A",
    sources: [
      official(
        "hunyuan-hy3-readme",
        "https://github.com/Tencent-Hunyuan/Hy3",
        "Official Hy3 quickstart states recommended parameters temperature 0.9 and top_p 1.0 and documents reasoning_effort values no_think, low, and high. The sampling recommendation is the same for direct and reasoning modes.",
      ),
      independent(
        "vllm-recipes-hy3",
        "https://recipes.vllm.ai/tencent/Hy3",
        "The independent vLLM Recipes page configures temperature=0.9 and top_p=1.0, corroborating the official recommendation.",
      ),
    ],
  },
  {
    id: "hy4-family",
    match: /^hy4(?:$|[-.])/,
    modes: {
      thinking: thinking(0.9, 1.0),
      nonThinking: nonThinking(0.9, 1.0),
    },
    evidence: "A",
    sources: [
      official(
        "hunyuan-hy4-readme",
        "https://github.com/Tencent-Hunyuan/Hy4-preview",
        "Official Hy4-preview quickstart states recommended parameters temperature 0.9 and top_p 1.0; reasoning defaults to high with no_think available for direct responses.",
      ),
      independent(
        "vllm-recipes-hy4",
        "https://recipes.vllm.ai/tencent/Hy4-preview",
        "The independent vLLM Recipes page states that Tencent recommends temperature=0.9 and top_p=1.0, corroborating the official recommendation.",
      ),
    ],
  },
  {
    id: "longcat-2-family",
    match: /^longcat-2(?:$|[-.])/,
    modes: {
      thinking: thinking(undefined, 0.95),
      nonThinking: nonThinking(undefined, 0.95),
    },
    evidence: "B",
    sources: [
      official(
        "longcat-model-params",
        "https://longcat.ai/platform/docs/api/model-params",
        "Official LongCat API documentation lists a top_p default of 0.95 and marks temperature as fixed and server-overridden (1.0 with thinking on, 0.7 with thinking off). Only top_p is applied; temperature is left to the provider rather than forced.",
      ),
    ],
  },
])
