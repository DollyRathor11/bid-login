import test from "node:test";
import assert from "node:assert/strict";
import { upsVerificationFields, verificationValue } from "../src/utils/upsVerification.js";

const bid = { bid_no: "GEM/UPS/1", dept_name: "IT", organization: "Buyer", qty: 2, pincode: "226020", address: "Lucknow", atc: "", start_date: "", end_date: "" };

test("blank optional fields and removed specs do not block UPS verification", () => {
  const checks = upsVerificationFields(bid, [{ key: "rating", required: true }, { key: "battery_capacity", required: false }], { rating: "3", battery_capacity: "", humidity: "85" });
  assert.equal(checks.length, 7);
  assert.ok(checks.some(field => field.key === "spec.rating"));
  assert.ok(!checks.some(field => ["spec.battery_capacity", "spec.humidity", "meta.atc", "meta.start_date", "meta.end_date"].includes(field.key)));
});

test("filled optional values and dates also need a verification tick", () => {
  const checks = upsVerificationFields({ ...bid, start_date: "2026-11-20", end_date: "2026-11-28", atc: "Buyer requirement" }, [{ key: "battery_capacity", required: false }], { battery_capacity: "9" });
  for (const key of ["spec.battery_capacity", "meta.atc", "meta.start_date", "meta.end_date"]) assert.ok(checks.some(field => field.key === key));
});

test("a tick for an old value cannot verify a changed specification", () => {
  const checks = upsVerificationFields(bid, [{ key: "rating", required: true }], { rating: "3" });
  const verified = Object.fromEntries(checks.map(field => [field.key, verificationValue(field.value)]));
  assert.ok(checks.every(field => verified[field.key] === verificationValue(field.value)));
  const changed = upsVerificationFields(bid, [{ key: "rating", required: true }], { rating: "5" });
  assert.ok(!changed.every(field => verified[field.key] === verificationValue(field.value)));
  assert.deepEqual(upsVerificationFields(null, [], {}), []);
});
