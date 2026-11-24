// Run with `npm test`.
import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  DEFAULT_ADDRESSES as A,
  callbackUrl,
  crmTileOpen,
  isLocalHost,
  isStaffMode,
  isStaffRoles,
  isUseStaffLinkError,
  parseCallbackHash,
  resolveNext,
  safeAdminNext,
  staffLinkUrl,
  storeAdminTileOpen,
} from "./staffLink.ts";

describe("staff mode detection", () => {
  it("staff. host or VITE_APP_MODE=staff", () => {
    assert.equal(isStaffMode("staff.momentspackaging.com"), true);
    assert.equal(isStaffMode("localhost", "staff"), true);
    assert.equal(isStaffMode("momentspackaging.com"), false);
    assert.equal(isStaffMode("localhost", "shop"), false);
    assert.equal(isStaffMode("notstaff.example.com"), false);
  });
});

describe("next origin checks", () => {
  it("accepts the CRM and the shop", () => {
    const crm = resolveNext(
      "https://crm.momentspackaging.com/leads?x=1",
      A,
      "staff.momentspackaging.com",
    );
    assert.deepEqual(crm, { target: "CRM", origin: A.crmUrl, path: "/leads?x=1" });
    const shop = resolveNext(
      "https://momentspackaging.com/admin/orders",
      A,
      "staff.momentspackaging.com",
    );
    assert.equal(shop?.target, "STORE_ADMIN");
    assert.equal(shop?.path, "/admin/orders");
  });
  it("rejects other origins, lookalikes, junk and non-http", () => {
    for (const bad of [
      "https://evil.com/admin",
      "https://crm.momentspackaging.com.evil.com/",
      "http://crm.momentspackaging.com/",
      "javascript:alert(1)",
      "//evil.com",
      "/relative",
      "",
      null,
      undefined,
      "https://user:p@crm.momentspackaging.com/",
    ])
      assert.equal(resolveNext(bad as string, A, "staff.momentspackaging.com"), null, String(bad));
  });
  it("localhost only when running locally", () => {
    assert.equal(
      resolveNext("http://localhost:5173/admin/x", A, "staff.momentspackaging.com"),
      null,
    );
    assert.equal(
      resolveNext("http://localhost:5173/admin/x", A, "localhost")?.target,
      "STORE_ADMIN",
    );
    assert.equal(resolveNext("http://localhost:5174/leads", A, "localhost")?.target, "CRM");
    assert.equal(isLocalHost("localhost.evil.com"), false);
  });
});

describe("callback addresses and hash", () => {
  it("builds both callbacks", () => {
    assert.equal(
      callbackUrl(A.crmUrl, "CRM", "abc", "/leads"),
      "https://crm.momentspackaging.com/auth/callback#code=abc&next=%2Fleads",
    );
    assert.equal(
      callbackUrl(A.shopUrl + "/", "STORE_ADMIN", "abc"),
      "https://momentspackaging.com/admin/auth/callback#code=abc",
    );
  });
  it("parses #code and next", () => {
    assert.deepEqual(parseCallbackHash("#code=abc&next=%2Fadmin%2Forders"), {
      code: "abc",
      next: "/admin/orders",
    });
    assert.deepEqual(parseCallbackHash(""), { code: null, next: null });
    assert.deepEqual(parseCallbackHash("#next=/admin/x"), { code: null, next: "/admin/x" });
  });
  it("only /admin paths survive", () => {
    assert.equal(safeAdminNext("/admin/orders?a=1"), "/admin/orders?a=1");
    for (const bad of [
      "https://evil.com",
      "//evil.com",
      "/account",
      "/admin/login",
      "/admin/auth/callback",
      "/adminx",
      "/admin/x" + String.fromCharCode(92) + "y",
      null,
      "",
    ])
      assert.equal(safeAdminNext(bad), "/admin/dashboard", String(bad));
  });
  it("staff link carries the wanted page", () => {
    assert.equal(
      staffLinkUrl(A.staffUrl, A.shopUrl, "/admin/orders"),
      "https://staff.momentspackaging.com/?next=https%3A%2F%2Fmomentspackaging.com%2Fadmin%2Forders",
    );
    assert.equal(staffLinkUrl(A.staffUrl, A.shopUrl), "https://staff.momentspackaging.com/");
  });
});

describe("tile fading rules", () => {
  it("store admin", () => {
    assert.equal(storeAdminTileOpen([]), false);
    assert.equal(storeAdminTileOpen(undefined), false);
    assert.equal(storeAdminTileOpen(["ENQUIRY_VIEW", "ENQUIRY_EDIT"]), false);
    assert.equal(storeAdminTileOpen(["PERM.ENQUIRY_VIEW"]), false);
    assert.equal(storeAdminTileOpen(["ENQUIRY_VIEW", "ORDER_VIEW"]), true);
  });
  it("CRM", () => {
    assert.equal(crmTileOpen(401, {}), false);
    assert.equal(crmTileOpen(403, { role: "ADMIN" }), false);
    assert.equal(crmTileOpen(200, { role: "NONE" }), false);
    assert.equal(crmTileOpen(200, {}), false);
    assert.equal(crmTileOpen(200, { role: "SALES" }), true);
    assert.equal(crmTileOpen(200, { user: { role: "none" } }), false);
  });
});

describe("customer login staff detection", () => {
  it("roles", () => {
    assert.equal(isStaffRoles(["ROLE_CUSTOMER"]), false);
    assert.equal(isStaffRoles(["ROLE_STAFF"]), true);
    assert.equal(isStaffRoles(["ROLE_CUSTOMER", "ROLE_ADMIN"]), true);
    assert.equal(isStaffRoles(undefined), false);
  });
  it("USE_STAFF_LINK", () => {
    assert.equal(isUseStaffLinkError(403, "USE_STAFF_LINK"), true);
    assert.equal(isUseStaffLinkError(undefined, "USE_STAFF_LINK"), true);
    assert.equal(isUseStaffLinkError(401, "USE_STAFF_LINK"), false);
    assert.equal(isUseStaffLinkError(403, "OTHER"), false);
  });
});
