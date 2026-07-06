import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { calculateLeadQuality } from "../src/services/leadQuality.ts";
import { createConversationState } from "../src/types/state.ts";

describe("lead quality", () => {
  it("returns hot for contact plus strong qualified demand", () => {
    const state = createConversationState({
      purpose: "kinh_doanh",
      business_type: "spa",
      area: "Quận 1",
      size: "100m2",
      structure: "tret_2_lau",
      budget: 50,
      contact: "0909123456",
    });

    assert.equal(calculateLeadQuality(state), "hot");
  });

  it("returns warm when contact exists but one or two fields are missing", () => {
    const state = createConversationState({
      purpose: "kinh_doanh",
      business_type: "spa",
      area: "Quận 1",
      budget: 50,
      contact: "0909123456",
    });

    assert.equal(calculateLeadQuality(state), "warm");
  });

  it("returns cold without contact", () => {
    const state = createConversationState({
      purpose: "kinh_doanh",
      business_type: "spa",
    });

    assert.equal(calculateLeadQuality(state), "cold");
  });
});
