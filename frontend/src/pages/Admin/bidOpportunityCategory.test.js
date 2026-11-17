import test from "node:test";
import assert from "node:assert/strict";

import { itemCategory } from "./bidOpportunityCategory.js";

test("shows a bunch of only our categories and UPS as Bunch Bid", () => {
  assert.equal(itemCategory({
    product_type: "aio",
    product_name: "All in One PC (V2), A4 and Legal Size Multifunction Printer (MFP), Line Interactive UPS with AVR (V2)",
  }), "bunch_bid");
  assert.equal(itemCategory({ product_name: "Laptop, Line Interactive UPS with AVR (V2)" }), "other");
  assert.equal(itemCategory({ product_name: "Interactive Panels with CPU, Entry and Mid Level Desktop Computer" }), "other");
  assert.equal(itemCategory({ product_name: "Line Interactive UPS with AVR (V3), All in One PC (V2)" }), "other");
  assert.equal(itemCategory({
    product_name: "Online UPS (≤10 KVA) Without Battery Conforming To IS 16242 (Part 1), Fixed Computer Workstation",
  }), "bunch_bid");
  assert.equal(itemCategory({ product_name: "Line Interactive UPS with AVR (V2)" }), "other");
});

test("does not treat a legacy false bunch flag on a single printer as Bunch Bid", () => {
  assert.equal(itemCategory({
    product_type: "bunch_bid",
    product_name: "A4 and Legal Size Multifunction Printer (MFP)",
  }), "printer");
});

test("keeps ordinary desktop categories unchanged", () => {
  assert.equal(itemCategory({ product_name: "High End Desktop Computer" }), "high_end_desktop");
  assert.equal(itemCategory({ product_name: "Entry and Mid Level Desktop Computer" }), "entry_mid_desktop");
  assert.equal(itemCategory({ product_name: "Desktop Computer" }), "other");
});

test("shows an all-approved bunch as Bunch Bid and still rejects A3 alone or PAC Only", () => {
  assert.equal(itemCategory({
    product_name: "All in One PC (V2), Entry and Mid Level Desktop Computer, A4 and Legal Size Multifunction Printer (MFP)",
  }), "bunch_bid");
  assert.equal(itemCategory({ product_name: "A3 Size Multifunction Printer (MFP)" }), "other");
  assert.equal(itemCategory({
    product_name: "A4 and Legal Size Multifunction Printer (MFP) (Q2) (PAC Only)",
  }), "other");
});

