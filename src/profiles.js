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

export const SAMPLING_PROFILES = Object.freeze([
  {
    id: "gemini-3-pro",
    match: /gemini-3-pro/,
    providers: ["google"],
    modes: {
      thinking: thinking(0.35),
      nonThinking: thinking(0.35),
      any: thinking(0.35),
    },
    env: {
      temperature: "OPENCODE_GEMINI3_TEMPERATURE",
      baseline: "OPENCODE_GEMINI3_BASELINE",
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
    id: "qwen3-family",
    match: /^qwen3(?:$|[-.])/,
    modes: {
      any: thinking(1.0, 0.95),
    },
    evidence: "B",
    sources: [
      official(
        "qwen3.8-max-blog",
        "https://qwen.ai/blog?id=qwen3.8",
        "Official Qwen3.8 Max release and benchmark guidance uses temperature 1.0; the hosted Max baseline uses top_p 0.95. These values are applied to the Qwen3.x family by user policy.",
      ),
      independent(
        "qwen3.8-max-sampling-card",
        "https://github.com/xbtlin/ai-berkshire/blob/836f0bf51ffa8f30c22bf730255ab8d64de56b91/reports/%E5%A4%A7%E6%A8%A1%E5%9E%8B%E5%85%A8%E6%99%AF%E5%AF%B9%E6%AF%94-20260906/evidence/Qwen__Qwen3.8-2.4T-A95B__README.md",
        "Archived Qwen model-card guidance records temperature 1.0, top_p 0.95, and top_k 20; this plugin only applies temperature and top_p.",
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
    evidence: "B",
    sources: [
      official(
        "deepseek-v4-blog",
        "https://huggingface.co/blog/deepseekv4",
        "DeepSeek V4 benchmark guidance uses temperature 1.0 and top_p 1.0; direct Go probes accepted both fields in thinking and non-thinking modes, while the upstream documentation says thinking may ignore them semantically.",
      ),
    ],
  },
  {
    id: "kimi-k2.7-opencode-go",
    match: /^kimi-k2\.7-code(?:$|[-.])/,
    providers: ["opencode-go"],
    modes: {
      thinking: thinking(1.0, 0.95),
    },
    evidence: "B",
    sources: [
      official(
        "kimi-k2.7-code-quickstart",
        "https://platform.kimi.ai/docs/guide/kimi-k2-7-code-quickstart",
        "Official K2.7 Code quickstart and thinking-mode documentation.",
      ),
      independent(
        "kimi-k2.7-opencode-constraints",
        "https://github.com/langgenius/dify-official-plugins/blob/f6b4a6a945b4e5909d7c9ceb4c593505f1a3238d/models/opencode-go/models/llm/llm.py",
        "Independent OpenCode Go provider forces temperature 1 and top_p 0.95 because the gateway rejects disabled thinking for K2.7 Code.",
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
    evidence: "B",
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
        "Official Kimi K3 benchmark conditions use temperature 1.0 and top_p 0.95.",
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
])
