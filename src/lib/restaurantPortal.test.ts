// Run with `npm test` (Node's own test runner; Node 23.6+ runs TypeScript directly).
import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  badgeLetters,
  brandColor,
  checkPassword,
  classifyJoinError,
  cleanCode,
  describeChange,
  describeHeadRequest,
  filterLines,
  groupByCategory,
  headRequestProblem,
  headRequestStatus,
  kes,
  priceRequestStatus,
  setupDoneSentence,
  splitTeam,
  textOn,
  type HeadRequestDraft,
  type PortalInvite,
  type PortalMember,
} from "./restaurantPortal.ts";

const member = (over: Partial<PortalMember>): PortalMember => ({
  id: "m1",
  name: "Mary Wanjiku",
  email: "mary@kg.example",
  role: "OWNER",
  active: true,
  ...over,
});

const invite = (over: Partial<PortalInvite>): PortalInvite => ({
  id: "i1",
  email: "x@kg.example",
  fullName: "X",
  role: "BUYER",
  status: "PENDING",
  ...over,
});

describe("splitTeam", () => {
  it("puts the owner first among heads, then joined heads, then pending head invites", () => {
    const { heads, staff } = splitTeam(
      [
        member({ id: "a", name: "David Otieno", email: "d@kg.example", role: "APPROVER" }),
        member({ id: "o" }),
        member({ id: "b", name: "James", email: "j@kg.example", role: "BUYER" }),
        member({ id: "gone", name: "Old", email: "old@kg.example", role: "BUYER", active: false }),
      ],
      [
        invite({ id: "g", fullName: "Grace Achieng", email: "g@kg.example", role: "APPROVER" }),
        invite({ id: "brian", fullName: "Brian", email: "brian@kg.example" }),
        invite({ id: "used", email: "J@kg.example", status: "PENDING" }), // already a member
        invite({ id: "exp", email: "e@kg.example", status: "EXPIRED" }),
      ],
    );
    assert.deepEqual(
      heads.map((h) => [h.name, h.joined]),
      [
        ["Mary Wanjiku", true],
        ["David Otieno", true],
        ["Grace Achieng", false],
      ],
    );
    assert.deepEqual(
      staff.map((s) => [s.name, s.joined]),
      [
        ["James", true],
        ["Brian", false],
      ],
    );
    assert.equal(heads[2].memberId, null);
  });
});

describe("join", () => {
  it("reads what joining still needs from the store's message", () => {
    assert.equal(classifyJoinError("Enter your first name."), "names");
    assert.equal(classifyJoinError("Enter your last name."), "names");
    assert.equal(classifyJoinError("Choose a password of at least 8 characters."), "password");
    assert.equal(classifyJoinError("That code is not right or has expired."), "code-error");
    assert.equal(
      classifyJoinError("Too many incorrect codes. Ask for a new invite."),
      "code-error",
    );
    assert.equal(classifyJoinError("That invite has expired. Ask for a new one."), "code-error");
  });

  it("accepts a 6-digit code with spaces", () => {
    assert.equal(cleanCode("731 506"), "731506");
    assert.equal(cleanCode("73150"), null);
    assert.equal(cleanCode("73150a"), null);
  });

  it("checks the password length and match", () => {
    assert.deepEqual(checkPassword("short", "short"), {
      longEnough: false,
      matches: true,
      ok: false,
    });
    assert.deepEqual(checkPassword("long enough!", "long enough"), {
      longEnough: true,
      matches: false,
      ok: false,
    });
    assert.equal(checkPassword("long enough!", "long enough!").ok, true);
  });
});

describe("head requests", () => {
  const base: HeadRequestDraft = {
    kind: "ADD",
    memberId: "",
    fullName: "Peter Mwangi",
    rank: "Operations manager",
    email: "peter@kg.example",
    phone: "",
    approvalRule: "",
    reason: "Runs our second branch",
  };

  it("lets a complete request through", () => {
    assert.equal(headRequestProblem(base, "ALL"), null);
  });

  it("asks for what is missing, in the store's words", () => {
    assert.match(
      headRequestProblem({ ...base, email: "nope" }, "ALL") ?? "",
      /full name, rank and email/,
    );
    assert.match(headRequestProblem({ ...base, kind: "REMOVE" }, "ALL") ?? "", /Choose which head/);
    assert.match(headRequestProblem({ ...base, reason: " " }, "ALL") ?? "", /Say why/);
    assert.equal(
      headRequestProblem({ ...base, kind: "RULE", approvalRule: "ALL" }, "ALL"),
      "That is already your rule.",
    );
    assert.equal(headRequestProblem({ ...base, kind: "RULE", approvalRule: "ANY" }, "ALL"), null);
  });

  it("describes a request and its status", () => {
    assert.equal(
      describeHeadRequest({ kind: "ADD", fullName: "Peter Mwangi", rank: "Operations manager" }),
      "add Peter Mwangi (Operations manager) as a head",
    );
    assert.equal(
      describeHeadRequest({ kind: "REPLACE", memberName: "David", fullName: "Peter" }),
      "replace David with Peter",
    );
    assert.equal(
      describeHeadRequest({ kind: "RULE", approvalRule: "ANY" }),
      "change the rule to: any one head approves",
    );
    assert.equal(headRequestStatus("PENDING").label, "Waiting for Moments");
    assert.equal(headRequestStatus("DECLINED").tone, "bad");
  });
});

describe("pricing requests", () => {
  it("never shows Moments' working steps", () => {
    for (const s of ["OPEN", "ASSIGNED", "PROPOSED"]) {
      assert.equal(priceRequestStatus(s).label, "With Moments");
    }
    assert.equal(priceRequestStatus("PUBLISHED", "KG-v3").label, "Priced · in KG-v3");
    assert.equal(priceRequestStatus("DECLINED").label, "Declined");
  });
});

describe("catalogue", () => {
  const lines = [
    { productId: "1", productName: "Kraft box 1000 ml", category: "Boxes" },
    { productId: "2", productName: "Kraft box 500 ml", category: "Boxes" },
    { productId: "3", productName: "Paper cup 8 oz", category: "Cups" },
    { productId: "4", productName: "Napkin", category: null },
  ];

  it("groups by category in order, with a fallback", () => {
    assert.deepEqual(
      groupByCategory(lines).map((g) => [g.category, g.lines.length]),
      [
        ["Boxes", 2],
        ["Cups", 1],
        ["Other", 1],
      ],
    );
  });

  it("filters by name or category", () => {
    assert.equal(filterLines(lines, "cup").length, 1);
    assert.equal(filterLines(lines, "BOXES").length, 2);
    assert.equal(filterLines(lines, "  ").length, 4);
  });

  it("formats money and announced changes", () => {
    assert.equal(kes(1190), "KES 1,190");
    assert.equal(kes("47350.5"), "KES 47,350.5");
    assert.equal(kes(null), "KES —");
    assert.equal(
      describeChange("2026-12-01T00:00:00+03:00", {
        productName: "Kraft box 1000 ml",
        oldPrice: 1100,
        newPrice: 1190,
        removed: false,
      }),
      "From 1 Dec: Kraft box 1000 ml goes from KES 1,100 to KES 1,190.",
    );
    assert.equal(
      describeChange("2026-12-01T00:00:00+03:00", { productName: "Napkin", removed: true }),
      "From 1 Dec: Napkin leaves your catalogue.",
    );
  });
});

describe("branding", () => {
  it("uses the restaurant's colour only when it is a plain hex colour", () => {
    assert.equal(brandColor("#1a472a"), "#1A472A");
    assert.equal(brandColor("red"), "#1D4F5A");
    assert.equal(brandColor(null), "#1D4F5A");
  });

  it("picks readable text on the brand colour", () => {
    assert.equal(textOn("#1D4F5A"), "#FFFFFF");
    assert.equal(textOn("#F2C14E"), "#17241C");
  });

  it("makes badge letters from the code or the name", () => {
    assert.equal(badgeLetters("Kijani Grill", "KG"), "KG");
    assert.equal(badgeLetters("Kijani Grill", null), "KG");
    assert.equal(badgeLetters("Java", null), "JA");
    assert.equal(badgeLetters("", null), "R");
  });
});

describe("setupDoneSentence", () => {
  const heads = splitTeam(
    [member({})],
    [
      invite({ id: "d", fullName: "David Otieno", email: "d@kg.example", role: "APPROVER" }),
      invite({ id: "g", fullName: "Grace Achieng", email: "g@kg.example", role: "APPROVER" }),
      invite({ id: "j", fullName: "James Kariuki", email: "j@kg.example", role: "BUYER" }),
    ],
  );

  it("matches the design's closing line", () => {
    assert.equal(
      setupDoneSentence(heads.heads, heads.staff, "ALL"),
      "David and Grace (heads) and James (staff) have their invites. Any of you can place an order; you, David and Grace approve it, then it goes to Moments.",
    );
    assert.equal(
      setupDoneSentence(heads.heads, heads.staff, "ANY"),
      "David and Grace (heads) and James (staff) have their invites. Any of you can place an order; one of you, David and Grace approves it, then it goes to Moments.",
    );
  });

  it("handles a contact person on their own", () => {
    const solo = splitTeam([member({})], []);
    assert.equal(
      setupDoneSentence(solo.heads, solo.staff, "ALL"),
      "Any of you can place an order; you approve it, then it goes to Moments.",
    );
  });
});
