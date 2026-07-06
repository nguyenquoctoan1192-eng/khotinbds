import { generateReplyStrict } from "../llm/openaiClient.ts";
import type { ConversationState, LeadQuality } from "../types/state.ts";
import { buildSystemPrompt } from "./promptBuilder.ts";

type GenerateNaturalReplyInput = {
  message: string;
  state: ConversationState;
  nextMissingField: string | null;
  leadQuality: LeadQuality;
  shouldHandoff: boolean;
  deterministicReply: string;
};

function buildReplyInstruction(input: GenerateNaturalReplyInput): string {
  return [
    "--- NHIỆM VỤ TRẢ LỜI WIDGET TƯ VẤN ---",
    "Viết đúng 1 câu trả lời ngắn, tự nhiên, thân thiện để gửi trực tiếp cho khách.",
    "Giữ vai Linh bên BDS, xưng em, gọi khách là anh/chị.",
    "Không nói mình là AI, bot, hệ thống, model hoặc đang dùng dữ liệu nội bộ.",
    "Không tự bịa căn nhà, giá, địa chỉ, chính sách hoặc thông tin chưa có.",
    "Phải phản hồi điều khách vừa nói trước, rồi mới hỏi tiếp nếu còn thiếu thông tin.",
    "Nếu next_missing_field khác null, chỉ hỏi đúng 1 thông tin còn thiếu đó.",
    "Nếu should_handoff=true, trả lời theo hướng đã nhận thông tin và sẽ có người hỗ trợ tiếp.",
    "Nếu không còn thiếu thông tin, xác nhận đã nhận nhu cầu và nói em sẽ lọc căn phù hợp.",
    "",
    `TIN NHẮN KHÁCH VỪA GỬI:\n${input.message}`,
    "",
    `NEXT_MISSING_FIELD:\n${input.nextMissingField ?? "null"}`,
    `LEAD_QUALITY:\n${input.leadQuality}`,
    `SHOULD_HANDOFF:\n${input.shouldHandoff}`,
    "",
    "REPLY DỰ PHÒNG ĐÚNG LOGIC CŨ:",
    input.deterministicReply,
    "",
    "Có thể viết tự nhiên hơn reply dự phòng, nhưng không được đổi mục tiêu hỏi/không hỏi.",
  ].join("\n");
}

export async function generateNaturalReply(
  input: GenerateNaturalReplyInput
): Promise<string> {
  const systemPrompt = [
    buildSystemPrompt(input.state),
    "",
    buildReplyInstruction(input),
  ].join("\n");

  try {
    return await generateReplyStrict({
      systemPrompt,
      state: input.state,
      recentHistory: [{ role: "user", content: input.message }],
    });
  } catch (error) {
    console.error("OpenAI natural reply failed; falling back to deterministic reply", {
      error,
      nextMissingField: input.nextMissingField,
      leadQuality: input.leadQuality,
      shouldHandoff: input.shouldHandoff,
    });
    return input.deterministicReply;
  }
}
