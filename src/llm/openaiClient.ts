import OpenAI from "openai";
import type {
  ChatMessage,
  ConversationState,
  ExtractedConversationState,
} from "../types/state.ts";
import { extractedConversationStateJsonSchema } from "../types/state.ts";
import { extractRentalInfo } from "../services/rentalRules.ts";

const fallbackReply =
  "Dạ em xin phép trả lời anh/chị trong ít phút nữa ạ.";

let cachedClient: OpenAI | null = null;

function getClient() {
  if (!process.env.OPENAI_API_KEY) return null;
  if (!cachedClient) {
    cachedClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return cachedClient;
}

async function withOneRetry<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (firstError) {
    try {
      return await operation();
    } catch (secondError) {
      console.error("OpenAI request failed after retry", {
        firstError,
        secondError,
      });
      throw secondError;
    }
  }
}

function recentHistoryText(recentHistory: ChatMessage[]) {
  return recentHistory
    .slice(-8)
    .map((item) => `${item.role}: ${item.content}`)
    .join("\n");
}

function safeParseObject(value: string): ExtractedConversationState {
  try {
    const parsed: unknown = JSON.parse(value);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return parsed as ExtractedConversationState;
  } catch {
    return {};
  }
}

export async function extractState(input: {
  newMessage: string;
  currentState: ConversationState;
  recentHistory: ChatMessage[];
}): Promise<ExtractedConversationState> {
  const client = getClient();

  if (!client) {
    return extractRentalInfo(input.newMessage, input.currentState);
  }

  try {
    return await withOneRetry(async () => {
      const response = await client.responses.create(
        {
          model: process.env.OPENAI_MODEL_EXTRACT || "gpt-4.1-mini",
          input: [
            "Bạn là bộ trích xuất dữ liệu thuê nhà/mặt bằng.",
            "Chỉ trả về JSON các trường mới hoặc đã thay đổi theo schema.",
            "Không sinh văn phong hội thoại. Không thêm trường ngoài schema.",
            "",
            `STATE HIỆN TẠI:\n${JSON.stringify(input.currentState, null, 2)}`,
            "",
            `LỊCH SỬ GẦN NHẤT:\n${recentHistoryText(input.recentHistory)}`,
            "",
            `TIN NHẮN MỚI:\n${input.newMessage}`,
          ].join("\n"),
          text: {
            format: {
              type: "json_schema",
              name: "rental_state_delta",
              schema: extractedConversationStateJsonSchema,
              strict: false,
            },
          },
        },
        { timeout: 15000 }
      );

      return safeParseObject(response.output_text || "{}");
    });
  } catch {
    return extractRentalInfo(input.newMessage, input.currentState);
  }
}

export async function generateReply(input: {
  systemPrompt: string;
  state: ConversationState;
  recentHistory: ChatMessage[];
  knowledgeSnippet?: string;
}): Promise<string> {
  const client = getClient();

  if (!client) return fallbackReply;

  try {
    return await withOneRetry(async () => {
      const response = await client.responses.create(
        {
          model: process.env.OPENAI_MODEL_REPLY || "gpt-4.1",
          input: [
            input.systemPrompt,
            input.knowledgeSnippet
              ? `\nKIẾN THỨC PHÙ HỢP:\n${input.knowledgeSnippet}`
              : "",
            `\nSTATE HIỆN TẠI:\n${JSON.stringify(input.state, null, 2)}`,
            `\nLỊCH SỬ GẦN NHẤT:\n${recentHistoryText(input.recentHistory)}`,
          ].join("\n"),
        },
        { timeout: 20000 }
      );

      return (response.output_text || "").trim() || fallbackReply;
    });
  } catch {
    return fallbackReply;
  }
}

export async function generateReplyStrict(input: {
  systemPrompt: string;
  state: ConversationState;
  recentHistory: ChatMessage[];
  knowledgeSnippet?: string;
}): Promise<string> {
  const client = getClient();

  if (!client) {
    throw new Error("OpenAI API key is not configured.");
  }

  return withOneRetry(async () => {
    const response = await client.responses.create(
      {
        model: process.env.OPENAI_MODEL_REPLY || "gpt-4.1",
        input: [
          input.systemPrompt,
          input.knowledgeSnippet
            ? `\nKIẾN THỨC PHÙ HỢP:\n${input.knowledgeSnippet}`
            : "",
          `\nSTATE HIỆN TẠI:\n${JSON.stringify(input.state, null, 2)}`,
          `\nLỊCH SỬ GẦN NHẤT:\n${recentHistoryText(input.recentHistory)}`,
        ].join("\n"),
      },
      { timeout: 20000 }
    );

    const reply = (response.output_text || "").trim();
    if (!reply) {
      throw new Error("OpenAI returned an empty reply.");
    }

    return reply;
  });
}
