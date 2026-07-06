export type RentalPurpose = "o" | "kinh_doanh";
export type ContactType = "phone" | "zalo";
export type LeadQuality = "hot" | "warm" | "cold";
export type BusinessCategory =
  | "beauty"
  | "f_and_b"
  | "retail"
  | "office"
  | "warehouse"
  | "clinic"
  | "khac";

export type ChatMessage = {
  role: "user" | "assistant";
  content: string;
  createdAt?: string;
};

export type ConversationState = {
  purpose: RentalPurpose | null;
  business_type: string | null;
  business_category: BusinessCategory | null;
  area: string | null;
  size: string | null;
  structure: string | null;
  bedroom: number | null;
  wc: number | null;
  budget: number | null;
  contact: string | null;
  contact_type: ContactType | null;
  urgent: boolean;
  pain_point: string | null;
  objection: string | null;
  unclear_fields: string[];
  ask_count: Record<string, number>;
  notes: string | null;
};

export type ExtractedConversationState = Partial<ConversationState>;

export const defaultConversationState: ConversationState = {
  purpose: null,
  business_type: null,
  business_category: null,
  area: null,
  size: null,
  structure: null,
  bedroom: null,
  wc: null,
  budget: null,
  contact: null,
  contact_type: null,
  urgent: false,
  pain_point: null,
  objection: null,
  unclear_fields: [],
  ask_count: {},
  notes: null,
};

const nullableString = { type: ["string", "null"] };
const nullableNumber = { type: ["number", "null"] };

export const conversationStateJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    purpose: {
      anyOf: [{ type: "string", enum: ["o", "kinh_doanh"] }, { type: "null" }],
    },
    business_type: nullableString,
    business_category: {
      anyOf: [
        {
          type: "string",
          enum: [
            "beauty",
            "f_and_b",
            "retail",
            "office",
            "warehouse",
            "clinic",
            "khac",
          ],
        },
        { type: "null" },
      ],
    },
    area: nullableString,
    size: nullableString,
    structure: nullableString,
    bedroom: nullableNumber,
    wc: nullableNumber,
    budget: nullableNumber,
    contact: nullableString,
    contact_type: {
      anyOf: [{ type: "string", enum: ["phone", "zalo"] }, { type: "null" }],
    },
    urgent: { type: "boolean" },
    pain_point: nullableString,
    objection: nullableString,
    unclear_fields: { type: "array", items: { type: "string" } },
    ask_count: {
      type: "object",
      additionalProperties: { type: "number" },
    },
    notes: nullableString,
  },
} as const;

export const extractedConversationStateJsonSchema = {
  ...conversationStateJsonSchema,
  description:
    "Only include fields that changed or were newly detected from the latest customer message.",
} as const;

export function createConversationState(
  state?: Partial<ConversationState> | null
): ConversationState {
  return {
    ...defaultConversationState,
    ...(state ?? {}),
    unclear_fields: Array.isArray(state?.unclear_fields)
      ? state.unclear_fields
      : [],
    ask_count:
      state?.ask_count && typeof state.ask_count === "object"
        ? state.ask_count
        : {},
  };
}
