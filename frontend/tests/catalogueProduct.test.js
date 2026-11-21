import test from "node:test";
import assert from "node:assert/strict";
import { catalogueProductId, catalogueCategory } from "../src/utils/catalogueProduct.js";

test("AIO and workstation display identifiers use their real catalogue ID", () => {
  assert.equal(catalogueProductId({ id: "aio-catalogue-93", catalogue_id: 93 }), "93");
  assert.equal(catalogueProductId({ id: "catalogue-8", catalogue_id: 8 }), "8");
  assert.equal(catalogueProductId({ id: 540 }), "540");
  assert.equal(catalogueProductId({ id: "printer-5" }), null);
});

test("category selections recognize the catalogue's lowercase AIO value", () => {
  assert.equal(catalogueCategory("aio", ["Desktop", "AIO"]), "AIO");
  assert.equal(catalogueCategory("desktop", ["Desktop", "AIO"]), "Desktop");
});
