const assert = require("node:assert/strict");
const test = require("node:test");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

// The frontend package is ESM, so this classic content script is loaded by hand.
const sandbox = { module: { exports: {} } };
vm.runInNewContext(fs.readFileSync(path.join(__dirname, "gem-representation-replies.js"), "utf8"), sandbox);
const { parseReplyRows, publishedOn } = sandbox.module.exports;

const plain = (value) => JSON.parse(JSON.stringify(value));

test("reads section, query and reply, carrying a spanned section", () => {
  assert.deepEqual(plain(parseReplyRows([
    ["section", "Query", "Reply"],
    ["Product/Service specification", "Change the speakers", "Disagree"],
    ["Is the bid generic?", "It is generic"],
    ["", "Third query", "Agreed"],
    ["Terms and Conditions", "Warranty query", ""],
  ])), [
    { section: "Product/Service specification", query: "Change the speakers", reply: "Disagree" },
    { section: "Product/Service specification", query: "Is the bid generic?", reply: "It is generic" },
    { section: "Product/Service specification", query: "Third query", reply: "Agreed" },
  ]);
});

test("ignores a table without Query and Reply columns", () => {
  assert.deepEqual(plain(parseReplyRows([["Bid Section", "Submitted On"], ["a", "b"]])), []);
});

test("reads the response publication date", () => {
  assert.equal(publishedOn("Bid No: GEM/2025/B/5894420 Response Publication Date: 10-11-2026 04:15 PM section"), "10-11-2026 04:15 PM");
  assert.equal(publishedOn("nothing here"), "");
});
