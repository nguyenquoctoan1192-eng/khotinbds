import fs from "node:fs";
import path from "node:path";
import type { ConversationState } from "../types/state.ts";
import { matchIndustry } from "./knowledgeMatcher.ts";

let cachedCorePrompt: string | null = null;

function readPromptOnce(): string {
  if (cachedCorePrompt !== null) return cachedCorePrompt;

  const promptPath = path.join(process.cwd(), "prompts", "1_system_prompt_core.md");

  try {
    cachedCorePrompt = fs.readFileSync(promptPath, "utf8");
  } catch (error) {
    const cause = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
    const message = `Failed to read system prompt file at ${promptPath}. Cause: ${cause}`;
    console.error("[critical] promptBuilder failed to load core prompt", {
      promptPath,
      error,
    });
    throw new Error(message);
  }

  return cachedCorePrompt;
}

export function buildSystemPrompt(state: ConversationState): string {
  const systemPrompt = readPromptOnce();
  const knowledge = matchIndustry(state.business_type);
  const knowledgeSnippet = knowledge
    ? knowledge.sellingPoints.map((point) => `- ${point}`).join("\n")
    : "";

  return [
    systemPrompt,
    "",
    "--- KIẾN THỨC NGÀNH (chỉ dùng để tham khảo, không bịa thêm) ---",
    knowledgeSnippet || "Không có snippet ngành phù hợp.",
    "",
    "--- STATE HIỆN TẠI CỦA KHÁCH ---",
    JSON.stringify(state, null, 2),
  ].join("\n");
}
