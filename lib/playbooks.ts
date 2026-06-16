export type ConversationStage = "discover" | "qualify" | "recommend" | "handoff" | "followup";

export type PlaybookId =
  | "ask_photo"
  | "ask_video"
  | "ask_price_negotiation"
  | "ask_availability"
  | "ask_viewing_time"
  | "price_objection"
  | "need_more_options"
  | "hot_lead"
  | "change_location"
  | "pause_decision"
  | "ask_viewing"
  | "ask_contact"
  | "compare_properties";

export type PlaybookProfile = {
  name?: string | null;
  phone?: string | null;
  purpose?: string | null;
  business_type?: string | null;
  business?: string | null;
  location?: string | null;
  budget?: string | null;
  area?: string | null;
  structure?: string | null;
  frontage?: string | null;
  move_in_time?: string | null;
  stage?: ConversationStage | null;
};

export type PlaybookContext = {
  message: string;
  profile: PlaybookProfile;
  hasPropertySuggestions?: boolean;
  nextQuestion?: string;
};

export type Playbook = {
  id: PlaybookId;
  triggers: RegExp[];
  stage: ConversationStage;
  responseSkeleton: (context: PlaybookContext) => string;
};

export type PlaybookSelection = {
  intent: PlaybookId | null;
  stage: ConversationStage;
  playbook: Playbook | null;
  skeleton: string;
};

const normalizeText = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\u0111/g, "d")
    .replace(/\u0110/g, "D")
    .toLowerCase();

const hasCoreNeed = (profile: PlaybookProfile) =>
  Boolean(profile.location && profile.purpose && profile.budget);

const hasQualifiedNeed = (profile: PlaybookProfile) =>
  Boolean(hasCoreNeed(profile) && (profile.area || profile.structure || profile.frontage || profile.move_in_time));

const needsBusinessType = (profile: PlaybookProfile) =>
  profile.purpose === "kinh doanh" &&
  !profile.business_type &&
  /mat bang|kinh doanh|mặt bằng/i.test(String(profile.business || ""));

const formatNeed = (profile: PlaybookProfile) =>
  [
    profile.business_type || profile.business || profile.purpose,
    profile.location,
    profile.budget ? `tầm ${profile.budget}` : "",
  ]
    .filter(Boolean)
    .join(", ");

export const playbooks: Playbook[] = [
  {
    id: "ask_photo",
    triggers: [/co\s*(hinh|anh)\s*khong/, /gui\s*(hinh|anh)/, /hinh\s*(thuc te|that)/],
    stage: "handoff",
    responseSkeleton: ({ profile }) =>
      profile.phone
        ? "Dạ có anh. Em gửi hình thực tế qua Zalo cho mình xem rõ hơn nhé."
        : "Dạ có anh. Anh cho em xin Zalo nhé, em gửi hình thực tế cho mình xem được không?",
  },
  {
    id: "ask_video",
    triggers: [/co\s*video\s*khong/, /clip/, /quay\s*(video|can|nha)/],
    stage: "handoff",
    responseSkeleton: ({ profile }) =>
      profile.phone
        ? "Dạ có anh. Em gửi video thực tế qua Zalo để mình xem mặt bằng dễ hơn nhé."
        : "Dạ có anh. Anh cho em xin Zalo nhé, em gửi video thực tế cho mình xem dễ hơn được không?",
  },
  {
    id: "ask_price_negotiation",
    triggers: [/co\s*bot\s*duoc\s*khong/, /thuong\s*luong\s*duoc\s*khong/, /bot\s*duoc\s*khong/, /dam\s*phan\s*duoc\s*khong/],
    stage: "recommend",
    responseSkeleton: ({ profile }) =>
      profile.phone
        ? "Dạ thường vẫn thương lượng được một chút anh. Em hỏi lại chủ mức tốt nhất rồi nhắn Zalo cho mình nhé."
        : "Dạ thường vẫn thương lượng được một chút anh. Anh cho em xin Zalo nhé, em hỏi lại chủ mức tốt nhất rồi báo mình được không?",
  },
  {
    id: "ask_availability",
    triggers: [/con\s*can\s*nay\s*khong/, /can\s*nay\s*con\s*khong/, /chu\s*cho\s*thue\s*chua/, /con\s*cho\s*thue\s*khong/, /da\s*cho\s*thue\s*chua/],
    stage: "recommend",
    responseSkeleton: ({ profile }) =>
      profile.phone
        ? "Dạ để em kiểm tra lại với chủ xem căn này còn giữ được không rồi báo anh qua Zalo nhé."
        : "Dạ để em kiểm tra lại với chủ xem căn này còn giữ được không. Anh cho em xin Zalo nhé, em báo nhanh cho mình được không?",
  },
  {
    id: "ask_viewing_time",
    triggers: [/chieu\s*nay\s*xem\s*duoc\s*khong/, /mai\s*(di\s*)?xem\s*duoc\s*khong/, /toi\s*nay\s*xem\s*duoc\s*khong/, /sang\s*mai\s*xem\s*duoc\s*khong/],
    stage: "handoff",
    responseSkeleton: ({ profile }) =>
      profile.phone
        ? "Dạ được anh, em kiểm tra lịch chủ rồi chốt giờ xem phù hợp qua Zalo cho mình nhé."
        : "Dạ được anh, em kiểm tra lịch chủ trước. Anh cho em xin Zalo hoặc số điện thoại nhé, em chốt giờ xem cho mình được không?",
  },
  {
    id: "price_objection",
    triggers: [/dat\s*qua/, /gia\s*cao/, /mac\s*qua/, /co\s*bot\s*khong/, /re\s*hon/, /chi\s*co\s*\d+/, /toi\s*da\s*\d+/],
    stage: "recommend",
    responseSkeleton: ({ profile }) =>
      `Dạ em hiểu anh. Với ${formatNeed(profile) || "nhu cầu này"}, em sẽ ưu tiên lọc căn giá mềm hơn hoặc thương lượng tốt hơn cho mình. Anh muốn em giữ đúng khu này hay mở rộng khu lân cận một chút?`,
  },
  {
    id: "need_more_options",
    triggers: [/con\s*can\s*nao\s*khac/, /them\s*(can|lua chon)/, /xem\s*them/, /co\s*lua\s*chon\s*khac/],
    stage: "recommend",
    responseSkeleton: () =>
      "Dạ được anh. Em lọc thêm vài căn khác cho mình, ưu tiên căn nào dễ đi xem và sát ngân sách hơn.",
  },
  {
    id: "hot_lead",
    triggers: [/ung\s*(can|nha)/, /thich\s*(can|nha)/, /chot/, /lay\s*can\s*nay/, /muon\s*xem\s*ngay/, /di\s*xem\s*ngay/, /can\s*gap/, /gap\s*qua/],
    stage: "handoff",
    responseSkeleton: ({ message, profile }) => {
      const urgent = normalizeText(message).includes("can gap") || normalizeText(message).includes("gap qua");

      if (urgent) {
        return profile.phone
          ? "Dạ nếu mình cần gấp, em ưu tiên lọc căn xem được sớm và gửi lịch qua Zalo cho anh ngay nhé."
          : "Dạ nếu mình cần gấp, em ưu tiên căn xem được sớm cho anh. Anh cho em xin Zalo hoặc số điện thoại nhé, em gửi căn phù hợp và hẹn lịch nhanh cho mình được không?";
      }

      return profile.phone
        ? "Dạ căn này khá hợp đó anh. Em kiểm tra lịch xem và gửi thêm hình thực tế qua Zalo cho mình ngay."
        : "Dạ căn này khá hợp đó anh. Anh cho em xin Zalo hoặc số điện thoại nhé, em gửi hình thực tế và sắp lịch xem cho mình được không?";
    },
  },
  {
    id: "change_location",
    triggers: [/chuyen\s*(qua|sang)/, /doi\s*(qua|sang)\s*khu/, /qua\s+(quan|q|phu nhuan|binh thanh|go vap|tan binh|tan phu|thu duc)/],
    stage: "qualify",
    responseSkeleton: ({ profile }) =>
      `Dạ được anh, em chuyển hướng qua ${profile.location || "khu mới"} cho mình. Ngân sách mình vẫn giữ như cũ hay muốn chỉnh lại chút anh?`,
  },
  {
    id: "pause_decision",
    triggers: [/de\s*(anh|chi|minh)\s*suy\s*nghi/, /suy\s*nghi\s*them/, /de\s*xem\s*lai/, /chua\s*quyet/],
    stage: "followup",
    responseSkeleton: () =>
      "Dạ không sao anh, mình cứ cân nhắc thêm. Em giữ nhu cầu này lại, nếu có căn nào sáng hơn em báo anh xem trước nhé?",
  },
  {
    id: "ask_viewing",
    triggers: [/cho\s*(anh|chi|minh)\s*xem\s*(nha|can|mat bang)/, /muon\s*xem\s*(nha|can|mat bang)/, /di\s*xem/, /hen\s*xem/, /xem\s*thuc\s*te/],
    stage: "handoff",
    responseSkeleton: ({ profile }) =>
      profile.phone
        ? "Dạ được anh. Em kiểm tra lịch trống rồi gửi giờ xem phù hợp qua Zalo cho mình."
        : "Dạ được anh. Anh cho em xin Zalo hoặc số điện thoại nhé, em hẹn lịch xem thực tế cho mình được không?",
  },
  {
    id: "ask_contact",
    triggers: [/zalo/, /so\s*(dien\s*thoai|dt)/, /\bsdt\b/, /lien\s*he/],
    stage: "handoff",
    responseSkeleton: ({ profile }) =>
      profile.phone
        ? "Dạ em dùng số này để gửi hình và cập nhật căn phù hợp cho mình nhé."
        : "Dạ anh cho em xin Zalo hoặc số điện thoại nhé, em gửi hình và các căn phù hợp cho mình xem trước được không?",
  },
  {
    id: "compare_properties",
    triggers: [/so\s*sanh/, /can\s*nao\s*(hon|tot|hop)/, /nen\s*chon\s*can\s*nao/, /khac\s*nhau\s*sao/],
    stage: "recommend",
    responseSkeleton: () =>
      "Dạ để em so nhanh cho anh: mình nên ưu tiên căn cân bằng giữa vị trí, diện tích và ngân sách. Anh nghiêng về vị trí đẹp hay giá tốt hơn?",
  },
];

export const detectIntent = (message: string): PlaybookId | null => {
  const normalized = normalizeText(message);
  const playbook = playbooks.find((item) =>
    item.triggers.some((trigger) => trigger.test(normalized))
  );

  return playbook?.id || null;
};

export const detectConversationStage = (
  profile: PlaybookProfile,
  intent: PlaybookId | null,
  hasPropertySuggestions = false
): ConversationStage => {
  const playbook = intent ? playbooks.find((item) => item.id === intent) : null;

  if (playbook) return playbook.stage;
  if (profile.phone) return "handoff";
  if (hasPropertySuggestions || (profile.location && profile.budget)) return "recommend";
  if (hasQualifiedNeed(profile)) return "qualify";
  if (hasCoreNeed(profile)) return "qualify";

  return "discover";
};

export const selectPlaybook = (context: PlaybookContext): PlaybookSelection => {
  const detectedIntent = detectIntent(context.message);
  const autoIntent: PlaybookId | null =
    detectedIntent ||
    (hasCoreNeed(context.profile) && !context.profile.phone && !needsBusinessType(context.profile)
      ? "ask_contact"
      : null);
  const playbook = autoIntent ? playbooks.find((item) => item.id === autoIntent) || null : null;
  const stage = detectConversationStage(context.profile, autoIntent, context.hasPropertySuggestions);

  return {
    intent: autoIntent,
    stage,
    playbook,
    skeleton:
      playbook?.responseSkeleton(context) ||
      context.nextQuestion ||
      "Mình nói thêm nhu cầu một chút, em lọc sát hơn cho anh nhé.",
  };
};
