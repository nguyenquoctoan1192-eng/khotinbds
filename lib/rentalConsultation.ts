export type {
  BusinessCategory,
  ContactType,
  ConversationState as RentalConsultationState,
  ExtractedConversationState as ExtractedRentalInfo,
  LeadQuality,
  RentalPurpose,
} from "@/src/types/state";

export { defaultConversationState as defaultRentalState } from "@/src/types/state";
export { createConversationState as createRentalState } from "@/src/types/state";
export { calculateLeadQuality } from "@/src/services/leadQuality";
export {
  extractRentalInfo,
  generateRentalConsultantReply,
  getNextMissingField,
  mergeRentalState,
  shouldStopForBusy,
  summarizeRequirement,
} from "@/src/services/rentalRules";
export { detectEscalation as shouldHandoff } from "@/src/services/escalation";
