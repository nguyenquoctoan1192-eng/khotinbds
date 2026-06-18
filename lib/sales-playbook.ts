export type CustomerStage =
  | "new_lead"
  | "viewed_images"
  | "repeated_consulting"
  | "scheduled_viewing"
  | "after_viewing"
  | "interested_not_closed"
  | "deposit_stage"
  | "rejected";

export type CustomerNeed = {
  type?: string;
  business?: string;
  district?: string;
  budget?: number;
  minArea?: number;
};

export type GenerateContextualReplyInput = {
  customerMessage: string;
  customerStage?: CustomerStage | string | null;
  customerNeed?: CustomerNeed | null;
  viewedListings?: number;
  rejectedReasons?: string[];
  lastAction?: string | null;
};

export type SalesAssistantResult = {
  detectedIntent: string;
  emotion: string;
  nextGoal: string;
  suggestedReply: string;
  followUpQuestion: string;
};

type StagePlaybook = {
  name: string;
  goal: string;
  examples: Array<{
    customer_message: string;
    reply: string;
  }>;
};

const customerStages: CustomerStage[] = [
  "new_lead",
  "viewed_images",
  "repeated_consulting",
  "scheduled_viewing",
  "after_viewing",
  "interested_not_closed",
  "deposit_stage",
  "rejected",
];

export const salesPlaybook: { stages: Record<CustomerStage, StagePlaybook> } = {
  stages: {
    new_lead: {
      name: "Khách mới hỏi tin",
      goal: "Thu thập nhu cầu, không bán ngay",
      examples: [
        {
          customer_message: "Còn không em?",
          reply:
            "Dạ hiện bên em còn vài lựa chọn tương tự ạ. Mình đang tìm để ở, kinh doanh hay làm văn phòng để em gửi đúng nhu cầu hơn?",
        },
      ],
    },

    viewed_images: {
      name: "Khách đã xem hình",
      goal: "Biến khách từ xem tin sang đi xem nhà",
      examples: [
        {
          customer_message: "Để anh xem đã",
          reply:
            "Dạ mình xem giúp em nha. Thực tế nhiều căn nhìn ngoài hình chưa thể hiện hết không gian đâu ạ. Mình thấy vị trí hay mức giá đang phù hợp với nhu cầu chưa?",
        },
      ],
    },

    repeated_consulting: {
      name: "Khách hỏi tư vấn nhiều lần",
      goal: "Tóm gọn lựa chọn và ép rõ tiêu chí ưu tiên",
      examples: [
        {
          customer_message: "Còn căn nào khác không?",
          reply:
            "Dạ em lọc thêm được, nhưng để đỡ mất thời gian mình nên chốt lại tiêu chí quan trọng nhất trước. Mình ưu tiên vị trí, giá hay diện tích hơn ạ?",
        },
      ],
    },

    scheduled_viewing: {
      name: "Đã hẹn lịch xem",
      goal: "Xác nhận lịch, giảm rủi ro khách hủy hẹn",
      examples: [
        {
          customer_message: "Chiều nay xem được không?",
          reply:
            "Dạ được ạ. Em kiểm tra lại tình trạng căn trước để tránh mất thời gian cho mình. Mình đi xem khoảng mấy giờ là tiện nhất?",
        },
      ],
    },

    after_viewing: {
      name: "Sau khi xem nhà",
      goal: "Tìm điểm lăn tăn",
      examples: [
        {
          customer_message: "Để anh suy nghĩ",
          reply:
            "Dạ mình cân nhắc kỹ là đúng rồi ạ. Trong căn vừa xem có điểm nào mình còn lăn tăn để em hỗ trợ thêm thông tin không?",
        },
      ],
    },

    interested_not_closed: {
      name: "Khách quan tâm nhưng chưa chốt",
      goal: "Đẩy khách từ thích sang quyết định bước tiếp theo",
      examples: [
        {
          customer_message: "Căn này cũng được",
          reply:
            "Dạ vậy căn này đang khá sát nhu cầu của mình rồi ạ. Còn điểm nào cần em làm rõ trước khi mình quyết định giữ căn không?",
        },
      ],
    },

    deposit_stage: {
      name: "Chuẩn bị cọc",
      goal: "Giảm rủi ro, làm rõ hợp đồng",
      examples: [
        {
          customer_message: "Để anh suy nghĩ thêm",
          reply:
            "Dạ mình cân nhắc kỹ là đúng ạ. Trước khi quyết định, còn thông tin nào về hợp đồng, chủ nhà hoặc điều kiện thuê mà mình muốn em làm rõ thêm không?",
        },
      ],
    },

    rejected: {
      name: "Khách từ chối căn đã xem",
      goal: "Ghi nhận lý do và đổi hướng lọc căn",
      examples: [
        {
          customer_message: "Không hợp em ơi",
          reply:
            "Dạ em hiểu rồi ạ. Em sẽ loại nhóm căn tương tự để lọc lại sát hơn. Điểm chưa hợp chính là giá, vị trí hay công năng ạ?",
        },
      ],
    },
  },
};

const normalizeText = (value: unknown) =>
  String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase();

const isCustomerStage = (value: unknown): value is CustomerStage =>
  customerStages.includes(value as CustomerStage);

const formatBudget = (budget?: number) => {
  if (!budget || !Number.isFinite(budget)) return "";
  if (budget >= 1000000) {
    const million = budget / 1000000;
    return `${Number.isInteger(million) ? million : million.toFixed(1)}tr`;
  }

  return String(budget);
};

const summarizeNeed = (need?: CustomerNeed | null) => {
  if (!need) return "nhu cầu của mình";

  const parts = [
    need.type,
    need.business ? `ngành ${need.business}` : "",
    need.district ? `khu ${need.district}` : "",
    need.budget ? `tầm ${formatBudget(need.budget)}` : "",
    need.minArea ? `từ ${need.minArea}m2` : "",
  ].filter(Boolean);

  return parts.length ? parts.join(", ") : "nhu cầu của mình";
};

const detectIntent = (message: string, stage: CustomerStage) => {
  const text = normalizeText(message);

  if (/dat|cao|mac|qua gia|gia cao/.test(text)) return "phản hồi về giá";
  if (/suy nghi|can nhac|xem da|de anh|de chi|tu tu/.test(text)) {
    return stage === "after_viewing" ? "đang so sánh" : "cần thêm thời gian";
  }
  if (/xem nha|di xem|hen|lich|chieu nay|mai|may gio/.test(text)) {
    return "muốn đi xem";
  }
  if (/coc|giu can|dat coc|hop dong|chot/.test(text)) {
    return "chuẩn bị chốt";
  }
  if (/khong hop|bo qua|khong thich|thoi|huy|khong lay/.test(text)) {
    return "từ chối căn";
  }
  if (/hinh|anh|video|clip/.test(text)) return "muốn xem thêm hình ảnh";
  if (/can nao khac|gui them|them can|lua chon khac/.test(text)) {
    return "muốn thêm lựa chọn";
  }

  if (stage === "new_lead") return "hỏi thông tin ban đầu";
  if (stage === "repeated_consulting") return "đang so sánh nhiều lựa chọn";

  return "cần tư vấn";
};

const detectEmotion = (message: string, intent: string, rejectedReasons: string[]) => {
  const text = normalizeText(message);

  if (/dat|cao|mac|khong hop|huy|thoi|bo qua/.test(text)) return "ngại rủi ro";
  if (/suy nghi|can nhac|xem da|tu tu/.test(text)) return "chưa chắc chắn";
  if (/coc|chot|giu can/.test(text)) return "có tín hiệu chốt";
  if (/gap|som|hom nay|chieu nay|ngay mai/.test(text)) return "quan tâm cao";
  if (rejectedReasons.length > 0 || intent === "đang so sánh") return "đang cân nhắc";

  return "trung tính";
};

export const detectCustomerStage = (
  input: GenerateContextualReplyInput
): CustomerStage => {
  if (isCustomerStage(input.customerStage)) return input.customerStage;

  const message = normalizeText(input.customerMessage);
  const lastAction = normalizeText(input.lastAction);
  const rejectedReasons = input.rejectedReasons || [];
  const viewedListings = input.viewedListings || 0;

  if (
    rejectedReasons.length > 0 ||
    /khong hop|khong thich|huy|bo qua|khong lay|tu choi/.test(message)
  ) {
    return "rejected";
  }

  if (/coc|giu can|dat coc|hop dong|chot/.test(message + " " + lastAction)) {
    return "deposit_stage";
  }

  if (/da di xem|vua xem|sau khi xem|xem nha roi/.test(lastAction)) {
    if (/cung duoc|ung|thich|ok|duoc do/.test(message)) {
      return "interested_not_closed";
    }

    return "after_viewing";
  }

  if (/hen|lich xem|di xem|chieu nay|sang mai|ngay mai|may gio/.test(message)) {
    return "scheduled_viewing";
  }

  if (viewedListings >= 3 || /gui them|can nao khac|them can/.test(message)) {
    return "repeated_consulting";
  }

  if (viewedListings > 0 || /hinh|anh|video|clip|xem da/.test(message)) {
    return "viewed_images";
  }

  return "new_lead";
};

const getNextGoal = (
  stage: CustomerStage,
  intent: string,
  rejectedReasons: string[]
) => {
  if (intent === "phản hồi về giá") return "làm rõ biên độ ngân sách";
  if (intent === "từ chối căn") return "ghi nhận lý do và đổi hướng lọc căn";
  if (rejectedReasons.length > 0) return "xử lý lý do chưa phù hợp";

  return salesPlaybook.stages[stage].goal;
};

const buildFollowUpQuestion = (
  stage: CustomerStage,
  intent: string,
  rejectedReasons: string[]
) => {
  if (intent === "phản hồi về giá") {
    return "Mình muốn giữ đúng khu vực hay ưu tiên giảm ngân sách hơn ạ?";
  }

  if (intent === "muốn đi xem") {
    return "Mình đi xem khoảng mấy giờ là tiện nhất ạ?";
  }

  if (intent === "chuẩn bị chốt") {
    return "Mình muốn em làm rõ phần giá, cọc hay điều khoản thuê trước ạ?";
  }

  if (intent === "từ chối căn" || stage === "rejected") {
    return "Điểm chưa hợp chính là giá, vị trí hay công năng ạ?";
  }

  if (stage === "after_viewing") {
    return "Trong căn vừa xem có điểm nào mình còn lăn tăn nhất ạ?";
  }

  if (stage === "repeated_consulting") {
    return "Mình ưu tiên vị trí, giá hay diện tích hơn ạ?";
  }

  if (stage === "viewed_images") {
    return "Mình thấy vị trí hay mức giá đang phù hợp với nhu cầu chưa ạ?";
  }

  if (rejectedReasons.length > 0) {
    return "Ngoài các điểm đó, còn tiêu chí nào em cần tránh khi lọc căn mới không ạ?";
  }

  return "Mình đang tìm để ở, kinh doanh hay làm văn phòng để em gửi đúng nhu cầu hơn?";
};

const buildReply = (
  stage: CustomerStage,
  intent: string,
  emotion: string,
  needSummary: string,
  viewedListings: number,
  rejectedReasons: string[],
  lastAction: string | null | undefined,
  followUpQuestion: string
) => {
  const stageGoal = salesPlaybook.stages[stage].goal;
  const rejectedSummary = rejectedReasons.length
    ? ` Em ghi nhận các điểm mình chưa ưng là ${rejectedReasons.join(", ")}.`
    : "";
  const viewedSummary =
    viewedListings > 0 ? ` Mình đã xem qua ${viewedListings} lựa chọn rồi.` : "";
  const actionSummary = lastAction ? ` Em nắm là mình ${lastAction}.` : "";

  if (stage === "after_viewing" || intent === "đang so sánh") {
    return `Dạ mình cân nhắc kỹ là đúng rồi ạ.${actionSummary}${viewedSummary}${rejectedSummary} Với ${needSummary}, em sẽ tập trung làm rõ điểm còn lăn tăn thay vì gửi lan man. ${followUpQuestion}`;
  }

  if (stage === "rejected" || intent === "từ chối căn") {
    return `Dạ em hiểu rồi ạ.${rejectedSummary} Em sẽ loại nhóm căn tương tự và lọc lại sát ${needSummary} hơn. ${followUpQuestion}`;
  }

  if (stage === "deposit_stage" || intent === "chuẩn bị chốt") {
    return `Dạ tới bước này mình kiểm tra kỹ là rất cần thiết ạ. Với ${needSummary}, em sẽ ưu tiên làm rõ các điểm có thể ảnh hưởng quyết định cọc. ${followUpQuestion}`;
  }

  if (stage === "scheduled_viewing" || intent === "muốn đi xem") {
    return `Dạ được ạ. Trước khi đi xem em sẽ kiểm tra lại tình trạng căn để tránh mất thời gian cho mình. ${followUpQuestion}`;
  }

  if (stage === "repeated_consulting") {
    return `Dạ em lọc tiếp được ạ.${viewedSummary}${rejectedSummary} Để tư vấn gọn hơn, em sẽ bám theo mục tiêu: ${stageGoal.toLowerCase()}. ${followUpQuestion}`;
  }

  if (stage === "viewed_images" || intent === "muốn xem thêm hình ảnh") {
    return `Dạ mình xem hình trước giúp em nha. Với ${needSummary}, nhiều căn thực tế sẽ cần xem thêm bố cục và lối đi mới đánh giá đúng. ${followUpQuestion}`;
  }

  if (stage === "interested_not_closed") {
    return `Dạ vậy căn này đang khá sát ${needSummary} rồi ạ. Vì mình vẫn ${emotion}, em sẽ làm rõ điểm còn vướng trước khi mình quyết định bước tiếp theo. ${followUpQuestion}`;
  }

  return `Dạ em nắm nhu cầu ban đầu của mình rồi ạ. Với ${needSummary}, em cần gom đúng tiêu chí trước để gửi căn sát hơn. ${followUpQuestion}`;
};

export const generateContextualReply = (
  input: GenerateContextualReplyInput
): SalesAssistantResult => {
  const stage = detectCustomerStage(input);
  const rejectedReasons = input.rejectedReasons || [];
  const detectedIntent = detectIntent(input.customerMessage, stage);
  const emotion = detectEmotion(input.customerMessage, detectedIntent, rejectedReasons);
  const nextGoal = getNextGoal(stage, detectedIntent, rejectedReasons);
  const followUpQuestion = buildFollowUpQuestion(
    stage,
    detectedIntent,
    rejectedReasons
  );

  return {
    detectedIntent,
    emotion,
    nextGoal,
    suggestedReply: buildReply(
      stage,
      detectedIntent,
      emotion,
      summarizeNeed(input.customerNeed),
      input.viewedListings || 0,
      rejectedReasons,
      input.lastAction,
      followUpQuestion
    ),
    followUpQuestion,
  };
};
