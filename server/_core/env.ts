const required = (name: string) => process.env[name] ?? "";
// Hosting tools such as Claude Code reserve the name ANTHROPIC_API_KEY for themselves and drop it from the
// environment, so the product also accepts the same key under its own name.
const claudeKey = process.env.ANTHROPIC_API_KEY || process.env.RATEDAI_CLAUDE_KEY || "";

export const ENV = {
  isProduction: process.env.NODE_ENV === "production",
  databaseUrl: required("DATABASE_URL"),
  // Secret used to sign session and parent-unlock tokens (min 32 chars).
  cookieSecret: required("JWT_SECRET"),
  // Any OpenAI-compatible API (OpenAI, Azure OpenAI, OpenRouter, vLLM, ...).
  llmApiUrl: (process.env.LLM_API_URL || "https://api.openai.com/v1").replace(/\/+$/, ""),
  llmApiKey: required("LLM_API_KEY"),
  // Which kind of model API to call. "anthropic" uses Claude through Anthropic's own API (best results in Arabic
  // and for structured lessons); "openai" is any OpenAI-compatible endpoint (the default, kept for provider choice).
  // When unset, Claude is used if ANTHROPIC_API_KEY is set.
  llmProvider: ((process.env.LLM_PROVIDER || (claudeKey ? "anthropic" : "openai")).toLowerCase() === "anthropic" ? "anthropic" : "openai") as "anthropic" | "openai",
  anthropicApiKey: claudeKey,
  // Optional gateway/proxy in front of Anthropic's API. Not the ambient ANTHROPIC_BASE_URL, so a developer tool's
  // proxy settings can never redirect the product's traffic.
  anthropicApiUrl: (process.env.ANTHROPIC_API_URL || "https://api.anthropic.com").replace(/\/+$/, ""),
  // One model per kind of job. Lessons are long and structured, so they get the strongest model; chat, stories,
  // homework help, reports and the teacher chat use the faster, cheaper tier; safety classification uses the smallest.
  claudeModels: {
    lesson: process.env.CLAUDE_MODEL_LESSON || "claude-opus-5-5",
    chat: process.env.CLAUDE_MODEL_CHAT || "claude-sonnet-5-5",
    assistant: process.env.CLAUDE_MODEL_ASSISTANT || process.env.CLAUDE_MODEL_CHAT || "claude-sonnet-5-5",
    vision: process.env.CLAUDE_MODEL_VISION || process.env.CLAUDE_MODEL_CHAT || "claude-sonnet-5-5",
    summary: process.env.CLAUDE_MODEL_SUMMARY || process.env.CLAUDE_MODEL_CHAT || "claude-sonnet-5-5",
    safety: process.env.CLAUDE_MODEL_SAFETY || "claude-haiku-5-5",
  },
  // Ask Anthropic to re-run a request on a fallback model if its safety systems decline it (set to 0 to turn off).
  claudeFallbacks: process.env.CLAUDE_FALLBACKS !== "0",
  llmModel: process.env.LLM_MODEL || "gpt-4o-mini",
  llmVisionModel: process.env.LLM_VISION_MODEL || process.env.LLM_MODEL || "gpt-4o-mini",
  imageModel: process.env.IMAGE_MODEL || "gpt-image-1",
  // Set to "1" to also call the provider's /moderations endpoint (OpenAI-compatible).
  // With Claude it is on unless LLM_MODERATION=0 (a small Claude model classifies each child message).
  providerModeration:
    process.env.LLM_MODERATION === "1" ||
    ((process.env.LLM_PROVIDER || (claudeKey ? "anthropic" : "openai")).toLowerCase() === "anthropic" && process.env.LLM_MODERATION !== "0"),
  // Shown to parents as the privacy contact. Set before launch.
  privacyContactEmail: process.env.PRIVACY_CONTACT_EMAIL || "",
  // Comma-separated emails that get the "admin" role on registration.
  adminEmails: (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map(e => e.trim().toLowerCase())
    .filter(Boolean),
};
