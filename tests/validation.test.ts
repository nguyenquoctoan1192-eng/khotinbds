import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  extractPhoneNumber,
  normalizeBudget,
  normalizeSize,
} from "../src/services/validation.ts";

describe("validation helpers", () => {
  it("extracts Vietnamese phone numbers", () => {
    assert.equal(extractPhoneNumber("zalo 0909123456"), "0909123456");
    assert.equal(extractPhoneNumber("liên hệ +84909123456"), "+84909123456");
  });

  it("normalizes common budget phrases to million VND/month", () => {
    assert.equal(normalizeBudget("40 triệu"), 40);
    assert.equal(normalizeBudget("40tr"), 40);
    assert.equal(normalizeBudget("40 củ"), 40);
    assert.equal(normalizeBudget("40 chai"), 40);
    assert.equal(normalizeBudget("4 chục"), 40);
    assert.equal(normalizeBudget("dưới 50"), 50);
    assert.equal(normalizeBudget("tối đa 45"), 45);
  });

  it("normalizes size phrases", () => {
    assert.deepEqual(normalizeSize("5x20"), {
      dimensions: { width: 5, length: 20 },
      sqm: 100,
    });
    assert.deepEqual(normalizeSize("5 x 20"), {
      dimensions: { width: 5, length: 20 },
      sqm: 100,
    });
    assert.deepEqual(normalizeSize("100m"), { sqm: 100 });
    assert.deepEqual(normalizeSize("100 mét"), { sqm: 100 });
    assert.deepEqual(normalizeSize("100m2"), { sqm: 100 });
    assert.deepEqual(normalizeSize("100m²"), { sqm: 100 });
  });
});
