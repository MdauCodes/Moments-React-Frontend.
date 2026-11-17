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
    assert.equal(kes("47350.5"), "KES 47,350.50");
    assert.equal(kes(41449.6), "KES 41,449.60");
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

import { flowLayout, pdfFileName, pdfKes, pdfText } from "./restaurantPdfLayout.ts";

describe("PDF layout", () => {
  it("cleans text jsPDF's fonts can't print", () => {
    assert.equal(pdfText("Kijani’s “grill”  ✓ box"), 'Kijani\'s "grill" box');
    assert.equal(pdfText(null), "");
  });

  it("formats money for the PDF", () => {
    assert.equal(pdfKes(1190), "KES 1,190");
    assert.equal(pdfKes(47350.5), "KES 47,350.50");
  });

  it("flows sections down the pages, two cards a row", () => {
    const { pages, startPage } = flowLayout([3, 1]);
    assert.equal(pages.length, 1);
    assert.deepEqual(startPage, [0, 0]);
    const cards = pages[0].filter((i) => i.kind === "card");
    assert.equal(cards.length, 4);
    const big = flowLayout([40]);
    assert.ok(big.pages.length > 1);
    assert.ok(big.pages.every((p) => p.length > 0));
  });

  it("names files", () => {
    assert.equal(
      pdfFileName("Kijani: Grill", "catalogue", "KG-v3"),
      "Kijani Grill catalogue KG-v3.pdf",
    );
    assert.equal(pdfFileName(null), "document.pdf");
  });
});

import {
  canUploadAt,
  fileSize,
  isPoClosed,
  poStageText,
  signRuleText,
  signedCopyProblem,
} from "./restaurantPortal.ts";

describe("purchase orders", () => {
  it("says each stage in the restaurant's words", () => {
    assert.equal(poStageText("AWAITING_SIGNED_COPY").label, "Waiting for the signed copy");
    assert.equal(poStageText("AWAITING_SIGNED_COPY", "MPESA").label, "With the heads");
    assert.equal(
      poStageText("CHECKING_SIGNED_COPY").label,
      "With Moments · checking the signed copy",
    );
    assert.equal(poStageText("SENT_BACK").tone, "bad");
    assert.equal(
      poStageText("AWAITING_FINAL_SIGNATURE").label,
      "Waiting for Moments' final signature",
    );
    assert.equal(poStageText("SOMETHING_NEW").label, "In progress");
    assert.equal(isPoClosed("DELIVERED"), true);
    assert.equal(isPoClosed("ON_ITS_WAY"), false);
    assert.equal(canUploadAt("SENT_BACK"), true);
    assert.equal(canUploadAt("CHECKING_SIGNED_COPY"), false);
  });

  it("checks the signed copy's files like the store does", () => {
    const pdf = { name: "po.pdf", type: "application/pdf", size: 200_000 };
    assert.equal(signedCopyProblem([pdf]), null);
    assert.match(signedCopyProblem([]) ?? "", /Add the scan/);
    assert.match(signedCopyProblem(Array(11).fill(pdf)) ?? "", /Up to 10 files/);
    assert.match(
      signedCopyProblem([{ name: "po.heic", type: "image/heic", size: 10 }]) ?? "",
      /isn't a PDF, JPG or PNG/,
    );
    assert.match(signedCopyProblem([{ ...pdf, size: 11 * 1024 * 1024 }]) ?? "", /over 10 MB/);
    const big = { name: "p.jpg", type: "image/jpeg", size: 9 * 1024 * 1024 };
    assert.match(signedCopyProblem([big, big, big, big]) ?? "", /over 30 MB/);
    assert.equal(signedCopyProblem([big, big, big]), null);
    // a phone may leave the type blank: the name decides
    assert.equal(signedCopyProblem([{ name: "IMG_1.JPG", type: "", size: 5 }]), null);
  });

  it("formats sizes and the signing line", () => {
    assert.equal(fileSize(512), "512 B");
    assert.equal(fileSize(2048), "2 KB");
    assert.equal(fileSize(3.5 * 1024 * 1024), "3.5 MB");
    assert.equal(signRuleText("ALL", 3), "All 3 heads sign the printed PO.");
    assert.equal(signRuleText("ANY", 2), "Any one head signs the printed PO.");
    assert.equal(signRuleText("ALL", 1), "The head signs the printed PO.");
  });
});

import { clampQty, deliveryProblem, orderSummary } from "./restaurantPortal.ts";

describe("placing a PO", () => {
  const lines = [
    { productId: "a", productName: "Kraft box", unit: "pack", price: 1190 },
    { productId: "b", productName: "Cup", unit: null, price: "1450.50" },
    { productId: "c", productName: "Napkin", price: 380 },
  ];

  it("sums only what has a quantity", () => {
    const s = orderSummary(lines, { a: 2, b: 1, c: 0 });
    assert.deepEqual(
      s.lines.map((l) => [l.productId, l.qty, l.amount]),
      [
        ["a", 2, 2380],
        ["b", 1, 1450.5],
      ],
    );
    assert.equal(s.total, 3830.5);
    assert.equal(s.count, 3);
    assert.equal(orderSummary(lines, {}).lines.length, 0);
  });

  it("keeps quantities whole and in range", () => {
    assert.equal(clampQty("12"), 12);
    assert.equal(clampQty("-3"), 0);
    assert.equal(clampQty("abc"), 0);
    assert.equal(clampQty(2.7), 2);
    assert.equal(clampQty(123456), 9999);
  });

  it("checks delivery details like the store", () => {
    const base = {
      method: "DELIVERY" as const,
      address: "Woodvale Grove, Westlands",
      county: "Nairobi",
      receiver: "James Kariuki",
      phone: "0722 000 418",
    };
    assert.equal(deliveryProblem(base), null);
    assert.match(deliveryProblem({ ...base, receiver: "James" }) ?? "", /first and last/);
    assert.match(deliveryProblem({ ...base, address: "" }) ?? "", /where Moments should deliver/);
    assert.match(deliveryProblem({ ...base, phone: "07" }) ?? "", /phone number/);
    assert.equal(deliveryProblem({ ...base, method: "PICKUP", address: "", receiver: "" }), null);
  });
});

import {
  chargeDueText,
  creditUsedPct,
  payProblem,
  paymentMethodText,
  paymentStatusText,
  promptAmount,
} from "./restaurantPortal.ts";

describe("credit", () => {
  it("draws the used bar", () => {
    assert.equal(creditUsedPct(108550, 150000), 72);
    assert.equal(creditUsedPct(200000, 150000), 100);
    assert.equal(creditUsedPct(10, null), 0);
  });

  it("says when a charge is due", () => {
    assert.equal(chargeDueText({ deliveredAt: null, overdue: false }).label, "Due once delivered");
    assert.equal(
      chargeDueText({ deliveredAt: "2026-11-18T10:00:00Z", dueOn: "2026-12-18", overdue: false })
        .label,
      "Due 18 Dec",
    );
    assert.equal(
      chargeDueText({ deliveredAt: "2026-10-01T10:00:00Z", dueOn: "2026-10-31", overdue: true })
        .tone,
      "bad",
    );
  });

  it("checks a payment like the store", () => {
    assert.equal(promptAmount(24150.2), 24151);
    assert.equal(promptAmount(24150), 24150);
    assert.equal(payProblem(100, 0, "0712000318"), "Your restaurant owes nothing right now.");
    assert.match(payProblem(0, 500, "0712000318") ?? "", /between KES 1 and/);
    assert.match(payProblem(502, 500.5, "0712000318") ?? "", /KES 501/);
    assert.equal(payProblem(501, 500.5, "0712000318"), null);
    assert.match(payProblem(100, 500, "07") ?? "", /phone number/);
  });

  it("names payments", () => {
    assert.equal(paymentMethodText("MPESA_PROMPT"), "M-Pesa (from the portal)");
    assert.equal(paymentStatusText("PENDING").label, "Being confirmed");
    assert.equal(paymentStatusText("CONFIRMED").tone, "good");
  });
});

import { balanceMovementText, poPaymentBadge, vatShare } from "./restaurantPortal.ts";

describe("paying a PO (§23)", () => {
  it("names the new stages, and a new version to sign", () => {
    assert.equal(poStageText("AWAITING_PAYMENT").label, "Approved · waiting for payment");
    assert.equal(poStageText("CONFIRMING_PAYMENT").label, "Bank transfer · Moments is confirming");
    assert.equal(poStageText("AWAITING_TOP_UP").tone, "wait");
    assert.equal(poStageText("AWAITING_SIGNED_COPY", "MANUAL", 2).label, "Version 2 to sign");
    assert.equal(
      poStageText("AWAITING_SIGNED_COPY", "MANUAL", 1).label,
      "Waiting for the signed copy",
    );
  });

  it("says Paid / Not paid / On credit", () => {
    const m = (paidAmount: number, amountDue: number) => ({ total: 1000, paidAmount, amountDue });
    assert.equal(poPaymentBadge("MPESA", m(1000, 0), "WITH_MOMENTS").label, "Paid");
    assert.equal(poPaymentBadge("MPESA", m(0, 1000), "AWAITING_PAYMENT").label, "Not paid");
    assert.equal(
      poPaymentBadge("MPESA", m(400, 600), "AWAITING_PAYMENT").label,
      "Partly paid · KES 600 to pay",
    );
    assert.equal(
      poPaymentBadge("BANK_TRANSFER", m(0, 1000), "CONFIRMING_PAYMENT").label,
      "Bank transfer being confirmed",
    );
    assert.equal(poPaymentBadge("CREDIT", m(0, 0), "WITH_MOMENTS").label, "On credit");
    assert.equal(poPaymentBadge("MPESA", m(1000, 0), "CANCELLED").label, "Cancelled");
    assert.equal(poPaymentBadge("MPESA", null, "AWAITING_SIGNED_COPY").label, "Not paid");
  });

  it("works out VAT and names balance movements", () => {
    assert.equal(vatShare(1160), 160);
    assert.equal(vatShare(47390), 6536.55);
    assert.equal(balanceMovementText("KEPT_FROM_CANCEL"), "Kept from a cancelled order");
    assert.equal(balanceMovementText("APPLIED_TO_PO"), "Used towards an order");
  });
});

import { actionAllowed, actionLimitText, findAction } from "./restaurantPortal.ts";

describe("PO actions from the store (§23.10)", () => {
  const actions = [
    { key: "PAY", allowed: true, text: null },
    { key: "CANCEL", allowed: false, text: "Moments has this PO now. Ask Moments to cancel it." },
    { key: "UPLOAD_SIGNED_COPY", allowed: false, text: null },
  ];

  it("takes the store's answer, else the older fields", () => {
    assert.equal(actionAllowed(actions, "PAY", false), true);
    assert.equal(actionAllowed(actions, "CANCEL", true), false);
    assert.equal(actionAllowed([], "CANCEL", true), true);
    assert.equal(actionAllowed(undefined, "PAY", false), false);
    assert.equal(findAction(actions, "NOPE"), undefined);
  });

  it("gives the store's words for a refused action only", () => {
    assert.equal(
      actionLimitText(actions, "CANCEL"),
      "Moments has this PO now. Ask Moments to cancel it.",
    );
    assert.equal(actionLimitText(actions, "PAY"), null);
    assert.equal(actionLimitText(actions, "UPLOAD_SIGNED_COPY"), null);
  });
});

import { deliveryMethodText, signedCopyLabel } from "./restaurantPortal.ts";

describe("local test fixes (17 Nov)", () => {
  it("names delivery methods in plain words", () => {
    assert.equal(deliveryMethodText("PICKUP"), "We collect");
    assert.equal(deliveryMethodText("MANUAL_DELIVERY"), "Moments delivers");
    assert.equal(deliveryMethodText(null), "—");
    assert.equal(deliveryMethodText("Courier"), "Courier");
  });

  it("calls a copy the restaurant's own approval until Moments can see the PO", () => {
    assert.equal(signedCopyLabel("UPLOADED", "AWAITING_PAYMENT").label, "Approved by you");
    assert.equal(signedCopyLabel("UPLOADED", "CONFIRMING_PAYMENT").label, "Approved by you");
    assert.equal(signedCopyLabel("UPLOADED", "CHECKING_SIGNED_COPY").label, "Moments is checking");
    assert.equal(signedCopyLabel("ACCEPTED", "AWAITING_PAYMENT").label, "Accepted");
    assert.equal(signedCopyLabel("SENT_BACK", "SENT_BACK").label, "Sent back");
  });
});
