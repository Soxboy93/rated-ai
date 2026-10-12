/**
 * Image generation via any OpenAI-compatible `/images/generations` endpoint.
 * Returns a `data:` URL when the provider returns base64, or the provider URL.
 */
import { ENV } from "./env";

export type GenerateImageOptions = {
  prompt: string;
};

export type GenerateImageResponse = {
  url?: string;
};

export async function generateImage(options: GenerateImageOptions): Promise<GenerateImageResponse> {
  if (!ENV.llmApiKey) {
    throw new Error("LLM_API_KEY is not configured");
  }

  const response = await fetch(`${ENV.llmApiUrl}/images/generations`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${ENV.llmApiKey}`,
    },
    body: JSON.stringify({
      model: ENV.imageModel,
      prompt: options.prompt,
      n: 1,
      size: "1024x1024",
    }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Image generation failed (${response.status} ${response.statusText}): ${detail}`);
  }

  const result = (await response.json()) as { data?: Array<{ b64_json?: string; url?: string }> };
  const first = result.data?.[0];
  if (first?.b64_json) return { url: `data:image/png;base64,${first.b64_json}` };
  if (first?.url) return { url: first.url };
  throw new Error("Image generation returned no image");
}
