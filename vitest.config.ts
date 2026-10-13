import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  root: path.resolve(import.meta.dirname),
  resolve: {
    alias: {
      "@shared": path.resolve(import.meta.dirname, "shared"),
    },
  },
  test: {
    environment: "node",
    include: ["server/**/*.test.ts", "server/**/*.spec.ts"],
    env: {
      JWT_SECRET: "test-secret-test-secret-test-secret-1234",
      LLM_API_KEY: "test-key",
      // Tests never reach a real AI provider, even when keys exist in the developer's environment.
      LLM_PROVIDER: "openai",
      LLM_MODERATION: "0",
      ANTHROPIC_API_KEY: "",
      RATEDAI_CLAUDE_KEY: "",
    },
  },
});
