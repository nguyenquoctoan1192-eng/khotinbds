import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  extractRentalInfo,
  generateRentalConsultantReply,
} from "../src/services/rentalRules.ts";
import type { ConversationState } from "../src/types/state.ts";

describe("rental rule extraction", () => {
  it("extracts district 10 without matching district 1", () => {
    const extracted = extractRentalInfo("mình cần thuê ở quận 10");

    assert.equal(extracted.area, "Quận 10");
  });

  it("keeps the district before a negated correction", () => {
    const extracted = extractRentalInfo("mình cần quận 10, không phải quận 1");

    assert.equal(extracted.area, "Quận 10");
  });

  it("keeps district 1 when district 10 is negated", () => {
    const extracted = extractRentalInfo("mình cần quận 1, không phải quận 10");

    assert.equal(extracted.area, "Quận 1");
  });

  it("extracts bedrooms from plain room count in a mixed requirement", () => {
    const extracted = extractRentalInfo("mình muốn thuê căn quận 10, 3 phòng giá 20tr");

    assert.equal(extracted.bedroom, 3);
  });

  it("keeps area and bedroom through the original correction flow", () => {
    let state: Partial<ConversationState> | null = null;

    let result = generateRentalConsultantReply("mình thuê ở", state);
    state = result.state;

    result = generateRentalConsultantReply(
      "mình muốn thuê căn quận 10, 3 phòng giá 20tr",
      state
    );
    state = result.state;

    assert.equal(result.state.area, "Quận 10");
    assert.equal(result.state.bedroom, 3);

    result = generateRentalConsultantReply("mình cần quận 10, không phải quận 1", state);
    state = result.state;

    result = generateRentalConsultantReply("4x15 là được em", state);
    state = result.state;

    result = generateRentalConsultantReply("1 trệt 2 lầu", state);

    assert.equal(result.state.area, "Quận 10");
    assert.equal(result.state.bedroom, 3);
    assert.equal(result.next_missing_field, "contact");
  });
});
