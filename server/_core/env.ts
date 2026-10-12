const required = (name: string) => process.env[name] ?? "";

export const ENV = {
  isProduction: process.env.NODE_ENV === "production",
  databaseUrl: required("DATABASE_URL"),
  // Secret used to sign session and parent-unlock tokens (min 32 chars).
  cookieSecret: required("JWT_SECRET"),
  // Any OpenAI-compatible API (OpenAI, Azure OpenAI, OpenRouter, vLLM, ...).
  llmApiUrl: (process.env.LLM_API_URL || "https://api.openai.com/v1").replace(/\/+$/, ""),
  llmApiKey: required("LLM_API_KEY"),
  llmModel: process.env.LLM_MODEL || "gpt-4o-mini",
  llmVisionModel: process.env.LLM_VISION_MODEL || process.env.LLM_MODEL || "gpt-4o-mini",
  imageModel: process.env.IMAGE_MODEL || "gpt-image-1",
  // Set to "1" to also call the provider's /moderations endpoint (OpenAI-compatible).
  providerModeration: process.env.LLM_MODERATION === "1",
  // Comma-separated emails that get the "admin" role on registration.
  adminEmails: (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map(e => e.trim().toLowerCase())
    .filter(Boolean),
};
