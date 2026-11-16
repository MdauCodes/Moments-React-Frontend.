// ----------------------------------------------------------------------------
// Restaurant portal API (store backend `feat/restaurant-accounts`, handover doc 15 §18).
// A restaurant's people are ordinary store customers (ROLE_CUSTOMER) signed in with the usual
// cookie session; the store decides on every call what they may see and do. Shapes mirror the
// backend's RestaurantDtos / CatalogueDtos records.
// ----------------------------------------------------------------------------
import { apiUrl } from "@/config/api";
import { authFetch } from "@/contexts/AuthContext";
import type {
  ApprovalRule,
  HeadRequestKind,
  PortalInvite,
  PortalMember,
  RestaurantRole,
} from "@/lib/restaurantPortal";

export interface MyRestaurant {
  id: string;
  businessName: string;
  myRole: RestaurantRole;
  deliveryFeeOnCredit: boolean;
  signByEmail: boolean;
  signByMpesa: boolean;
  brandColor?: string | null;
  brandLogoUrl?: string | null;
  restaurantCode?: string | null;
  members: PortalMember[];
  invites: PortalInvite[];
  approvalRule: ApprovalRule;
  headsLocked: boolean;
  creditEnabled: boolean;
  creditLimit?: number | null;
  paymentTermsDays?: number | null;
}

export type Invite = PortalInvite;

export interface AcceptInviteInput {
  email: string;
  code: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  password?: string;
}

export interface AcceptInviteResult {
  restaurantName: string;
  role: RestaurantRole;
  newAccount: boolean;
}

export interface HeadInput {
  email: string;
  fullName: string;
  rank: string;
  phone?: string;
}

export interface StaffInput {
  email: string;
  fullName: string;
  rank?: string;
  phone?: string;
}

export interface HeadRequestInput {
  kind: HeadRequestKind;
  memberId?: string;
  fullName?: string;
  rank?: string;
  email?: string;
  phone?: string;
  approvalRule?: ApprovalRule;
  reason: string;
}

export interface HeadRequestRow {
  id: string;
  kind: HeadRequestKind;
  memberId?: string | null;
  memberName?: string | null;
  fullName?: string | null;
  rank?: string | null;
  email?: string | null;
  phone?: string | null;
  approvalRule?: string | null;
  currentRule?: string | null;
  reason?: string | null;
  status: string;
  requestedBy?: string | null;
  createdAt: string;
  decidedAt?: string | null;
  decisionNote?: string | null;
}

export interface CatalogueLine {
  productId: string;
  productName: string;
  slug?: string | null;
  category?: string | null;
  imageUrl?: string | null;
  unit?: string | null;
  price: number;
  priceSince?: string | null;
}

export interface ChangeLine {
  productId: string;
  productName: string;
  oldPrice?: number | null;
  newPrice?: number | null;
  removed: boolean;
}

export interface UpcomingVersion {
  label: string;
  effectiveFrom: string;
  changes: ChangeLine[];
}

export interface MyCatalogue {
  restaurantId: string;
  restaurantName: string;
  restaurantCode?: string | null;
  version?: string | null;
  effectiveFrom?: string | null;
  approvedAt?: string | null;
  approvedBy?: string | null;
  lines: CatalogueLine[];
  upcoming: UpcomingVersion[];
}

export interface MyPriceRequest {
  id: string;
  status: string;
  createdAt: string;
  requestedBy?: string | null;
  note?: string | null;
  items: { productId: string; productName: string; quantityNote?: string | null }[];
  declineReason?: string | null;
  publishedVersion?: string | null;
}

export interface PriceRequestInput {
  items: { productId: string; quantityNote?: string }[];
  note?: string;
}

/** An error from the store, with its HTTP status and the store's own message. */
export class RestaurantApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "RestaurantApiError";
  }
}

async function readError(res: Response, fallback: string): Promise<RestaurantApiError> {
  const body = (await res.json().catch(() => ({}))) as { message?: string; error?: string };
  let message = body.message || body.error || fallback;
  if (res.status === 429 && !body.message) message = "Too many tries. Wait a little and try again.";
  if (res.status === 403 && !body.message) message = "That isn't open to your role.";
  return new RestaurantApiError(message, res.status);
}

async function call<T>(
  path: string,
  init: RequestInit = {},
  fallback = "Something went wrong.",
): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body) headers.set("Content-Type", "application/json");
  const res = await authFetch(apiUrl(path), { ...init, headers });
  if (!res.ok) throw await readError(res, `${fallback} (${res.status})`);
  return (await res.json()) as T;
}

const post = <T>(path: string, body: unknown, fallback?: string) =>
  call<T>(path, { method: "POST", body: JSON.stringify(body) }, fallback);

export const restaurantApi = {
  /** Public: joining with the emailed code (5 wrong tries lock the invite). */
  async acceptInvite(input: AcceptInviteInput): Promise<AcceptInviteResult> {
    const res = await fetch(apiUrl("/api/v1/public/restaurant-invites/accept"), {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    if (!res.ok) throw await readError(res, "That code didn't work.");
    return (await res.json()) as AcceptInviteResult;
  },

  /** The signed-in member's restaurant; a 404 means they are not part of one. */
  async mine(): Promise<MyRestaurant | null> {
    const res = await authFetch(apiUrl("/api/v1/restaurant/me"));
    if (res.status === 404) return null;
    if (!res.ok) throw await readError(res, "Couldn't load your restaurant.");
    return (await res.json()) as MyRestaurant;
  },

  addHead: (head: HeadInput) =>
    post<Invite>("/api/v1/restaurant/me/heads", head, "Couldn't add that head."),

  inviteStaff: (person: StaffInput) =>
    post<Invite>(
      "/api/v1/restaurant/me/invites",
      { ...person, role: "BUYER" },
      "Couldn't invite that person.",
    ),

  finishSetup: () =>
    post<MyRestaurant>("/api/v1/restaurant/me/setup/finish", {}, "Couldn't finish the setup."),

  headRequests: () =>
    call<HeadRequestRow[]>("/api/v1/restaurant/me/head-requests", {}, "Couldn't load requests."),

  requestHeadChange: (input: HeadRequestInput) =>
    post<HeadRequestRow>(
      "/api/v1/restaurant/me/head-requests",
      input,
      "Couldn't send the request.",
    ),

  catalogue: () =>
    call<MyCatalogue>("/api/v1/restaurant/me/catalogue", {}, "Couldn't load your catalogue."),

  priceRequests: () =>
    call<MyPriceRequest[]>("/api/v1/restaurant/me/price-requests", {}, "Couldn't load requests."),

  requestPrices: (input: PriceRequestInput) =>
    post<MyPriceRequest>(
      "/api/v1/restaurant/me/price-requests",
      input,
      "Couldn't send the pricing request.",
    ),
};
