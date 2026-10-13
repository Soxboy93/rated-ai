/**
 * Quick connection test: sends one tiny request to every model the app is configured to use and reports whether it
 * answered. Costs a fraction of a cent. Run with the key in the environment, never typed into a chat or a file:
 *   ANTHROPIC_API_KEY=... pnpm ai:check
 */
import { ENV } from "../server/_core/env";
import { invokeLLM, type LLMTask } from "../server/_core/llm";

if (ENV.llmProvider === "anthropic" && !ENV.anthropicApiKey) { console.log("No key: set ANTHROPIC_API_KEY or RATEDAI_CLAUDE_KEY in the environment."); process.exit(1); }
console.log(`Provider: ${ENV.llmProvider}${ENV.llmProvider === "anthropic" ? ` (${ENV.anthropicApiUrl})` : ` (${ENV.llmApiUrl})`}`);
const tasks: LLMTask[] = ["chat", "lesson", "assistant", "vision", "summary"];
let failed = 0;
for (const task of tasks) {
  const started = Date.now();
  try {
    const out = await invokeLLM({ task, messages: [{ role: "user", content: "Reply with the single word: OK" }], maxTokens: 50 });
    const text = String(out.choices[0].message.content).trim();
    console.log(`  ${task.padEnd(9)} ${String(out.model ?? "?").padEnd(20)} ${String(Date.now() - started).padStart(5)} ms  → ${text.slice(0, 40)}`);
  } catch (e) {
    failed++;
    console.log(`  ${task.padEnd(9)} FAILED: ${String(e).slice(0, 200)}`);
  }
}
if (ENV.llmProvider === "anthropic") {
  const { classifyChildMessage } = await import("../server/_core/anthropic");
  const started = Date.now();
  const category = await classifyChildMessage("بدي أموت");
  console.log(`  safety    ${ENV.claudeModels.safety.padEnd(20)} ${String(Date.now() - started).padStart(5)} ms  → ${category ?? "UNAVAILABLE"}`);
  if (category !== "self_harm") failed++;
}
console.log(failed ? `${failed} check(s) failed` : "All connections work.");
process.exit(failed ? 1 : 0);
