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
    baselines: { temperature: 1 },
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
    id: "glm-5.3-thinking-only",
    match: /^glm-5\.3(?:$|[-.])/,
    alwaysThinking: true,
    defaultMode: "thinking",
    modes: {
      thinking: thinking(1.0),
    },
    evidence: "B",
    sources: [
      official(
        "glm-5.3-guide",
        "https://docs.z.ai/guides/llm/glm-5.3.md",
        "Official GLM-5.3 documentation requires thinking and uses temperature 1.0 in its examples.",
      ),
    ],
  },
  {
    id: "glm-5-opencode-go",
    match: /^glm-5(?:$|[-.])/,
    providers: ["opencode-go"],
    alwaysThinking: true,
    defaultMode: "thinking",
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
    id: "qwen3-max",
    match: /^qwen3\.(?:7|8)-max(?:$|[-.])/,
    modes: {
      any: thinking(1.0, 0.95),
    },
    evidence: "B",
    sources: [
      official(
        "qwen3.8-max-blog",
        "https://qwen.ai/blog?id=qwen3.8",
        "Official Qwen3.8 Max release and benchmark guidance uses temperature 1.0; the hosted Max baseline uses top_p 0.95.",
      ),
      independent(
        "qwen3.8-max-sampling-card",
        "https://github.com/xbtlin/ai-berkshire/blob/836f0bf51ffa8f30c22bf730255ab8d64de56b91/reports/%E5%A4%A7%E6%A8%A1%E5%9E%8B%E5%85%A8%E6%99%AF%E5%AF%B9%E6%AF%94-20260906/evidence/Qwen__Qwen3.8-2.4T-A95B__README.md",
        "Archived Qwen model-card guidance records temperature 1.0, top_p 0.95, and top_k 20; this plugin only applies temperature and top_p.",
      ),
    ],
  },
  {
    id: "deepseek-v4",
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
    alwaysThinking: true,
    defaultMode: "thinking",
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
    id: "kimi-family",
    match: /^kimi-(?:k2\.6|k2\.7-code|k3)(?:$|[-.])/,
    defaultMode: "thinking",
    modes: {
      thinking: thinking(1.0, 0.95),
      nonThinking: nonThinking(0.6, 0.95),
    },
    baselines: { temperature: 1.0, topP: 0.95 },
    evidence: "B",
    sources: [
      official(
        "kimi-k2.6-quickstart",
        "https://platform.kimi.ai/docs/guide/kimi-k2-6-quickstart",
        "Official Kimi K2.6 guidance distinguishes thinking temperature 1.0 from instant temperature 0.6.",
      ),
      official(
        "kimi-k3-readme",
        "https://github.com/MoonshotAI/Kimi-K3",
        "Official Kimi K3 benchmark conditions use temperature 1.0 and top_p 0.95.",
      ),
      official(
        "kimi-k2.7-code-quickstart",
        "https://platform.kimi.ai/docs/guide/kimi-k2-7-code-quickstart",
        "Official K2.7 Code guidance is used as family context; the Go route has a separate thinking-only safety override.",
      ),
    ],
  },
  {
    id: "minimax-family",
    match: /^minimax-m(?:2|3)(?:$|[-.])/,
    modes: {
      thinking: thinking(1.0, 0.95),
      nonThinking: nonThinking(0.1, 0.95),
    },
    baselines: { temperature: 1.0, topP: 0.95 },
    evidence: "B",
    sources: [
      official(
        "minimax-m2-readme",
        "https://github.com/MiniMax-AI/MiniMax-M2",
        "Official M2 family guidance uses temperature 1.0 and top_p 0.95 for the general hosted configuration.",
      ),
      official(
        "minimax-m3-readme",
        "https://github.com/MiniMax-AI/MiniMax-M3",
        "Official M3 guidance uses temperature 1.0 and top_p 0.95 for thinking.",
      ),
      official(
        "minimax-anthropic-api",
        "https://platform.minimax.io/docs/api-reference/text-anthropic-api",
        "Official hosted API documentation; direct Go probes accepted M2.5 and M3 with the family values.",
      ),
      community(
        "minimax-family-heuristic",
        "https://github.com/Nvb-flipped/helpdesk-triage-demo/blob/3b8b886ab45ca41dbda40ac93b6a276821247b17/docs/evaluation.md",
        "The available task benchmark does not independently validate 0.1 for the whole family; it is a user-selected family extrapolation.",
      ),
    ],
  },
  {
    id: "mimo-v2.5",
    match: /^mimo-v2\.5(?:$|[-.])/,
    modes: {
      thinking: thinking(1.0, 0.95),
      nonThinking: nonThinking(0.7, 0.95),
    },
    evidence: "B",
    sources: [
      independent(
        "mimo-v2.5-pro-recipe",
        "https://github.com/sgl-project/sglang-jax/blob/11248f5adbd3633a4b21bbc8af01483edd727bfd/docs/cookbook/autoregressive/Xiaomi/MiMo-V2.5-Pro.md",
        "Validated V2.5 Pro recipe uses temperature 1.0 and top_p 0.95 for thinking and temperature 0.7 for tool calling; the latter is mapped to the non-thinking preset as a task proxy.",
      ),
    ],
  },
  {
    id: "mimo-v2-flash",
    match: /^mimo-v2-flash(?:$|[-.])/,
    modes: {
      thinking: thinking(0.3, 0.95),
      nonThinking: nonThinking(0.8, 0.95),
    },
    evidence: "B",
    sources: [
      official(
        "mimo-v2-flash-readme",
        "https://github.com/XiaomiMiMo/MiMo-V2-Flash/blob/b4eaae40d3728657ff7f0f9397dcce3c9ab3d3b7/README.md",
        "Official MiMo-V2-Flash guidance uses top_p 0.95, temperature 0.8 for math/writing/web-dev, and temperature 0.3 for agentic/tool-use tasks; those task categories are mapped to thinking and non-thinking presets.",
      ),
    ],
  },
])
