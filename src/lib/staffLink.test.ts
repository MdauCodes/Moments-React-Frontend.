// Run with `npm test`.
import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  DEFAULT_ADDRESSES as A,
  callbackUrl,
  crmTileOpen,
  hasSignedOutFlag,
  isLocalHost,
  decodeJwtClaims,
  isStaffAccount,
  isStaffMode,
  isStaffRoles,
  isUseStaffLinkError,
  parseCallbackHash,
  resolveNext,
  safeAdminNext,
  staffLinkUrl,
  staffSignedOutUrl,
  storeAdminTileOpen,
  withoutSignedOut,
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
  it("accountType wins; roles only when absent", () => {
    assert.equal(isStaffRoles(["ROLE_CUSTOMER"], "BUSINESS"), false);
    assert.equal(isStaffRoles(["ROLE_ADMIN"], "INDIVIDUAL_SHOPPER"), false);
    assert.equal(isStaffRoles(["ROLE_CUSTOMER"], "STAFF"), true);
    assert.equal(isStaffRoles(["ROLE_STAFF"], null), true);
    assert.equal(isStaffRoles(["ROLE_STAFF"], ""), true);
  });
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

describe("signed-out handling", () => {
  it("builds the staff sign-out address", () => {
    assert.equal(staffSignedOutUrl("https://staff.momentspackaging.com/"), "https://staff.momentspackaging.com/?signedout=1");
  });
  it("detects the flag", () => {
    assert.equal(hasSignedOutFlag("?signedout=1"), true);
    assert.equal(hasSignedOutFlag("?signedout=0"), false);
    assert.equal(hasSignedOutFlag(""), false);
  });
  it("removes only the flag", () => {
    assert.equal(withoutSignedOut("/", "?signedout=1"), "/");
    assert.equal(withoutSignedOut("/", "?signedout=1&next=x", "#h"), "/?next=x#h");
  });
});

describe("next origin: www", () => {
  it("accepts www.momentspackaging.com as the shop", () => {
    const r = resolveNext("https://www.momentspackaging.com/admin/orders", A, "staff.momentspackaging.com");
    assert.deepEqual(r, { target: "STORE_ADMIN", origin: "https://www.momentspackaging.com", path: "/admin/orders" });
  });
  it("still rejects other origins", () => {
    assert.equal(resolveNext("https://evil.momentspackaging.com/", A, "staff.momentspackaging.com"), null);
  });
});

function jwt(claims: object): string {
  const b = (o: object) => Buffer.from(JSON.stringify(o)).toString("base64url");
  return `${b({ alg: "HS256" })}.${b(claims)}.sig`;
}

describe("redirect to the staff sign-in", () => {
  it("next carries the full address of the page they wanted", () => {
    assert.equal(
      staffLinkUrl(A.staffUrl, "https://momentspackaging.com", "/admin"),
      "https://staff.momentspackaging.com/?next=https%3A%2F%2Fmomentspackaging.com%2Fadmin",
    );
    assert.equal(
      staffLinkUrl(A.staffUrl, "https://momentspackaging.com", "/admin/orders?x=1"),
      "https://staff.momentspackaging.com/?next=https%3A%2F%2Fmomentspackaging.com%2Fadmin%2Forders%3Fx%3D1",
    );
  });
  it("the link's next is accepted by the staff site", () => {
    const u = new URL(staffLinkUrl(A.staffUrl, "https://momentspackaging.com", "/admin/orders"));
    const r = resolveNext(u.searchParams.get("next"), A, "staff.momentspackaging.com");
    assert.equal(r?.target, "STORE_ADMIN");
    assert.equal(r?.path, "/admin/orders");
  });
});

describe("staff detection from token claims", () => {
  it("decodes a token payload; junk gives null", () => {
    assert.deepEqual(decodeJwtClaims(jwt({ isStaff: true })), { isStaff: true });
    assert.equal(decodeJwtClaims("nope"), null);
    assert.equal(decodeJwtClaims(undefined), null);
  });
  it("token isStaff or staffRole means staff, even if accountType says customer", () => {
    assert.equal(isStaffAccount({ accessToken: jwt({ isStaff: true }), accountType: "BUSINESS" }), true);
    assert.equal(isStaffAccount({ accessToken: jwt({ staffRole: "ADMIN" }) }), true);
  });
  it("user-object flags, then accountType/roles as fallback", () => {
    assert.equal(isStaffAccount({ isStaff: true }), true);
    assert.equal(isStaffAccount({ roles: ["ROLE_CUSTOMER"], accountType: "BUSINESS" }), false);
    assert.equal(isStaffAccount({ accessToken: jwt({ isStaff: false }), roles: ["ROLE_STAFF"] }), true);
    assert.equal(isStaffAccount({ accessToken: jwt({ isStaff: false }), roles: ["ROLE_CUSTOMER"] }), false);
  });
});
