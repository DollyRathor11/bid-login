import test from "node:test";
import assert from "node:assert/strict";
import { bunchReviewItems, bunchAdminPath, bunchProductPath, resolveBunchNavigation } from "../src/utils/bunchNavigation.js";

const context = { bidNo: "GEM/123", product: "desktop", id: 7, returnTo: "/analyser-dashboard/bunch?status=pending&page=2" };

test("single bid navigation stays unchanged", () => {
  const options = { state: { bidData: { id: 7 } } };
  assert.deepEqual(resolveBunchNavigation("/analyser-dashboard/desktop/bid/7", null, "/analyser-document", options), { to: "/analyser-document", options });
  assert.deepEqual(resolveBunchNavigation("/analyser-document", null, -1), { to: -1, options: undefined });
});

test("every product keeps bunch tabs and document data when opening documents", () => {
  for (const [product, path] of [["desktop", "/analyser-document"], ["aio", "/analyser-dashboard/aio/document"], ["printer", "/analyser-dashboard/printer/document"], ["toner", "/analyser-dashboard/toner/document"], ["workstation", "/analyser-dashboard/workstation/bid/7/documents"]]) {
    const bunch = { ...context, product };
    const target = resolveBunchNavigation(bunchProductPath(product, 7), bunch, path, { state: { bidData: { id: 7, model_number: "ABC" } } });
    assert.equal(target.to, path);
    assert.deepEqual(target.options.state.bunchReview, bunch);
    assert.equal(target.options.state.bidData.model_number, "ABC");
  }
});

test("successful submission returns to the same product in the bunch read-only", () => {
  for (const product of ["desktop", "aio", "printer", "toner", "workstation"]) {
    const bunch = { ...context, product };
    const target = resolveBunchNavigation("/analyser-document", bunch, `/analyser-dashboard/${product}`);
    assert.equal(target.to, bunchProductPath(product, 7));
    assert.equal(target.options.state.readOnly, true);
    assert.equal(target.options.state.bunchReview.submitted, true);
    assert.equal(target.options.state.bunchReview.returnTo, context.returnTo);
  }
});

test("back from documents opens the current form and back from form restores list filters", () => {
  for (const path of ["/analyser-document", "/analyser-dashboard/aio/document", "/analyser-dashboard/workstation/bid/7/documents"]) {
    assert.equal(resolveBunchNavigation(path, context, -1).to, "/analyser-dashboard/desktop/bid/7");
  }
  assert.equal(resolveBunchNavigation("/analyser-dashboard/desktop/bid/7", context, -1).to, context.returnTo);
});

test("UPS has an embedded bunch review route and unrelated navigation exits normally", () => {
  assert.equal(bunchProductPath("ups", 5), "/analyser-dashboard/bunch/ups/5");
  const ups = { ...context, product: "ups", id: 5 };
  const next = resolveBunchNavigation(bunchProductPath("ups", 5), ups, "/analyser-dashboard/bunch/ups/5/documents", { state: { bidData: { id: 5 } } });
  assert.deepEqual(next.options.state.bunchReview, ups);
  assert.equal(next.options.state.bidData.id, 5);
  assert.equal(resolveBunchNavigation("/analyser-dashboard/bunch/ups/5/documents", ups, -1).to, bunchProductPath("ups", 5));
  assert.deepEqual(resolveBunchNavigation("/analyser-document", context, "/analyser-dashboard/product"), { to: "/analyser-dashboard/product", options: undefined });
});


test("admin product forms return to the original bunch status and page", () => {
  const admin = { ...context, role: "admin", returnTo: "/admin-dashboard/bunch-bid-approval?status=approved&page=2" };
  for (const product of ["desktop", "aio", "workstation", "printer", "toner"]) {
    const path = bunchAdminPath(product, 7, "approved");
    assert.ok(path.startsWith(`/admin-dashboard/${product}-bid-approval?`));
    assert.equal(new URLSearchParams(path.split("?")[1]).get("bid"), "7");
    assert.equal(resolveBunchNavigation(path, admin, "/admin-dashboard/all-bids-approval?status=approved").to, admin.returnTo);
  }
  assert.equal(bunchAdminPath("ups", 7), "/admin-dashboard/bunch/ups/7");
  assert.equal(resolveBunchNavigation("/review", admin, -1).to, admin.returnTo);
});

test("admin re-analysis opens only the returned product from a mixed bunch", () => {
  const rows = [{ product: "desktop", id: 1, status: "pending" }, { product: "aio", id: 2, status: "re-analyze" }, { product: "ups", id: 3, status: "approved" }];
  const admin = { role: "admin", returnTo: "/admin-dashboard/bunch-bid-approval?status=re-analyze" };
  assert.deepEqual(bunchReviewItems(rows, admin), [rows[1]]);
  assert.deepEqual(bunchReviewItems(rows, { ...admin, reviewStatus: "pending" }), [rows[0]]);
  assert.deepEqual(bunchReviewItems(rows, { ...admin, reviewStatus: "approved" }), [rows[2]]);
  assert.deepEqual(bunchReviewItems(rows, { role: "analyser" }), rows);
  assert.deepEqual(rows.map(row => row.status), ["pending", "re-analyze", "approved"]);
});