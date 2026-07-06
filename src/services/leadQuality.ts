import type { ConversationState, LeadQuality } from "../types/state.ts";

export function calculateLeadQuality(state: ConversationState): LeadQuality {
  const requiredFields = [
    state.purpose,
    state.purpose === "kinh_doanh" ? state.business_type : "not_required",
    state.area,
    state.size,
    state.structure,
    state.budget,
  ];
  const filledRequired = requiredFields.filter(Boolean).length;
  const hasAllRequired = filledRequired === requiredFields.length;

  if (state.contact && state.budget && state.area && (state.urgent || hasAllRequired)) {
    return "hot";
  }

  if (state.contact && filledRequired >= requiredFields.length - 2) {
    return "warm";
  }

  return "cold";
}
