import { useNavigate } from "react-router-dom";

import { useEffect, useMemo, useState, useCallback } from "react";
import { toast } from "sonner";
import { X, Phone, MessageCircle, Mail } from "lucide-react";
import { SiteLayout } from "@/components/SiteLayout";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth, authFetch } from "@/contexts/AuthContext";
import { apiUrl } from "@/config/api";
import { useSiteConfig } from "@/contexts/SiteConfigContext";



// Matches the backend's legacy OrderStatus enum (order/entity/OrderStatus.java) — this page
// stays on that shared 9-value model rather than the new per-fulfillment-mode statuses (see
// src/lib/orderStatusV2.ts), since it's a separate legacy page with its own mock-data-first
// Order type (no fulfillmentType field) — folding it into the new system would mean giving it
// that field and a live-data rewrite, disproportionate to fixing its type drift from the real
// backend enum. Previously missing PAYMENT_VERIFIED/REFUNDED, which the real backend can send.
type OrderStatus =
  | "PENDING_PAYMENT"
  | "PAID"
  | "PAYMENT_VERIFIED"
  | "IN_PRODUCTION"
  | "READY_FOR_DISPATCH"
  | "DISPATCHED"
  | "DELIVERED"
  | "CANCELLED"
  | "REFUNDED";

interface OrderItem {
  productName: string;
  size?: string;
  material?: string;
  finish?: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

interface OrderCustomer {
  firstName?: string;
  lastName?: string;
  name?: string;
  email: string;
  phone?: string;
  address?: string;
  county?: string;
}

interface Order {
  id: string;
  reference: string;
  customer: OrderCustomer;
  items: OrderItem[];
  itemCount: number;
  total: number;
  subtotal?: number;
  deliveryFee?: number;
  paymentMethod: "MPESA" | "BANK" | "COD";
  paymentReceipt?: string;
  paymentProof?: string;
  status: OrderStatus;
  staffNotes?: string;
  assignedTo?: string;
  createdAt: string;
}

interface StaffUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  roles: string[];
}

interface DashboardStats {
  ordersToday: number;
  ordersPending: number;
  ordersInProduction: number;
  revenueToday: number;
}

const STATUS_LABEL: Record<OrderStatus, string> = {
  PENDING_PAYMENT: "Pending Payment",
  PAID: "Paid",
  PAYMENT_VERIFIED: "Payment Verified",
  IN_PRODUCTION: "In Production",
  READY_FOR_DISPATCH: "Ready",
  DISPATCHED: "Dispatched",
  DELIVERED: "Delivered",
  CANCELLED: "Cancelled",
  REFUNDED: "Refunded",
};

const STATUS_COLOR: Record<OrderStatus, string> = {
  PENDING_PAYMENT: "bg-[#c4622d]/10 text-[#c4622d]",
  PAID: "bg-blue-100 text-blue-700",
  PAYMENT_VERIFIED: "bg-teal-100 text-teal-700",
  IN_PRODUCTION: "bg-[#a07850]/15 text-[#a07850]",
  READY_FOR_DISPATCH: "bg-amber-100 text-amber-800",
  DISPATCHED: "bg-indigo-100 text-indigo-700",
  DELIVERED: "bg-[#2d4a3e]/10 text-[#2d4a3e]",
  CANCELLED: "bg-red-100 text-red-700",
  REFUNDED: "bg-rose-100 text-rose-700",
};

const TABS: Array<{ key: OrderStatus | "ALL"; label: string }> = [
  { key: "ALL", label: "All" },
  { key: "PENDING_PAYMENT", label: "Pending Payment" },
  { key: "PAID", label: "Paid" },
  { key: "PAYMENT_VERIFIED", label: "Payment Verified" },
  { key: "IN_PRODUCTION", label: "In Production" },
  { key: "READY_FOR_DISPATCH", label: "Ready" },
  { key: "DISPATCHED", label: "Dispatched" },
  { key: "DELIVERED", label: "Delivered" },
  { key: "CANCELLED", label: "Cancelled" },
  { key: "REFUNDED", label: "Refunded" },
];

const NEXT_STATUSES: Record<OrderStatus, OrderStatus[]> = {
  PENDING_PAYMENT: ["PAID", "CANCELLED"],
  PAID: ["PAYMENT_VERIFIED", "IN_PRODUCTION", "CANCELLED"],
  PAYMENT_VERIFIED: ["IN_PRODUCTION", "CANCELLED"],
  IN_PRODUCTION: ["READY_FOR_DISPATCH", "CANCELLED"],
  READY_FOR_DISPATCH: ["DISPATCHED", "CANCELLED"],
  DISPATCHED: ["DELIVERED", "CANCELLED"],
  DELIVERED: [],
  CANCELLED: [],
  REFUNDED: [],
};

const MOCK_STATS: DashboardStats = {
  ordersToday: 5,
  ordersPending: 8,
  ordersInProduction: 12,
  revenueToday: 45000,
};

const MOCK_ORDERS: Order[] = [
  {
    id: "o1",
    reference: "MPK-1042",
    customer: {
      firstName: "Aisha",
      lastName: "Mwangi",
      email: "aisha@example.co.ke",
      phone: "0712345678",
      address: "Kilimani, Argwings Kodhek Rd",
      county: "Nairobi",
    },
    items: [
      { productName: "Kraft takeaway box", size: "M", material: "Kraft", finish: "Matte", quantity: 500, unitPrice: 35, lineTotal: 17500 },
    ],
    itemCount: 1,
    total: 18000,
    subtotal: 17500,
    deliveryFee: 500,
    paymentMethod: "MPESA",
    paymentReceipt: "QHJ7K2L9PA",
    status: "PAID",
    staffNotes: "",
    createdAt: new Date(Date.now() - 2 * 3600_000).toISOString(),
  },
  {
    id: "o2",
    reference: "MPK-1041",
    customer: {
      firstName: "Brian",
      lastName: "Otieno",
      email: "brian@example.co.ke",
      phone: "0723456789",
      address: "Westlands, Mpaka Rd",
      county: "Nairobi",
    },
    items: [
      { productName: "Cake window box", size: "L", material: "Coated", finish: "Gloss", quantity: 200, unitPrice: 90, lineTotal: 18000 },
    ],
    itemCount: 1,
    total: 18500,
    subtotal: 18000,
    deliveryFee: 500,
    paymentMethod: "BANK",
    status: "PENDING_PAYMENT",
    createdAt: new Date(Date.now() - 26 * 3600_000).toISOString(),
  },
  {
    id: "o3",
    reference: "MPK-1040",
    customer: {
      firstName: "Cynthia",
      lastName: "Kamau",
      email: "cynthia@example.co.ke",
      phone: "0734567890",
      address: "Karen, Ngong Rd",
      county: "Nairobi",
    },
    items: [
      { productName: "Garment mailer", quantity: 1000, unitPrice: 18, lineTotal: 18000 },
    ],
    itemCount: 1,
    total: 19000,
    paymentMethod: "COD",
    status: "IN_PRODUCTION",
    createdAt: new Date(Date.now() - 5 * 24 * 3600_000).toISOString(),
  },
];

const MOCK_USERS: StaffUser[] = [
  { id: "u1", firstName: "Joy", lastName: "Wanjiru", email: "joy@momentspackaging.co.ke", roles: ["ROLE_STAFF"] },
  { id: "u2", firstName: "Peter", lastName: "Njoroge", email: "peter@momentspackaging.co.ke", roles: ["ROLE_ADMIN"] },
];

function relTime(iso: string) {
  const d = new Date(iso).getTime();
  const diff = Date.now() - d;
  const m = Math.floor(diff / 60_000);
  if (m < 1) return "just now";
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} hour${h === 1 ? "" : "s"} ago`;
  if (h < 48) return "Yesterday";
  const days = Math.floor(h / 24);
  return `${days} days ago`;
}

function formatKES(n: number) {
  return new Intl.NumberFormat("en-KE").format(Math.round(n));
}

function maskEmail(email: string) {
  const [u, d] = email.split("@");
  if (!d) return email;
  return `${u.slice(0, 2)}${u.length > 2 ? "•••" : ""}@${d}`;
}

function StaffPage() {
  const { isAuthenticated, isStaff, isAdmin, refreshToken } = useAuth();
  const navigate = useNavigate();
  const allowed = isStaff || isAdmin;

  useEffect(() => {
    document.title = "Staff Orders — Moments Packaging Kenya";
  }, []);

  useEffect(() => {
    if (!isAuthenticated) {
      navigate("/account/login", { replace: true });
      return;
    }
    if (!allowed) {
      toast.error("Access denied");
      navigate("/", { replace: true });
    }
  }, [isAuthenticated, allowed, navigate]);

  if (!isAuthenticated || !allowed) return null;

  return (
    <SiteLayout>
      <StaffDashboard refresh={refreshToken} />
    </SiteLayout>
  );
}

function StaffDashboard({ refresh }: { refresh: () => Promise<string | null> }) {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [tab, setTab] = useState<OrderStatus | "ALL">("ALL");
  const [orders, setOrders] = useState<Order[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(true);
  const [staffUsers, setStaffUsers] = useState<StaffUser[]>([]);
  const [selected, setSelected] = useState<Order | null>(null);

  const fetchAuth = useCallback(
    async (path: string, init?: RequestInit) => authFetch(apiUrl(path), init, refresh),
    [refresh],
  );

  // Stats
  useEffect(() => {
    let cancelled = false;
    setStatsLoading(true);
    fetchAuth("/api/v1/admin/dashboard/stats")
      .then(async (r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled) return;
        setStats({
          ordersToday: data?.ordersToday ?? MOCK_STATS.ordersToday,
          ordersPending: data?.ordersPending ?? MOCK_STATS.ordersPending,
          ordersInProduction: data?.ordersInProduction ?? MOCK_STATS.ordersInProduction,
          revenueToday: data?.revenueToday ?? MOCK_STATS.revenueToday,
        });
      })
      .catch(() => !cancelled && setStats(MOCK_STATS))
      .finally(() => !cancelled && setStatsLoading(false));
    return () => {
      cancelled = true;
    };
  }, [fetchAuth]);

  // Staff users (for assignee dropdown)
  useEffect(() => {
    let cancelled = false;
    fetchAuth("/api/v1/admin/users")
      .then(async (r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled) return;
        const arr: StaffUser[] = Array.isArray(data) ? data : data?.content ?? [];
        const filtered = arr.filter((u) =>
          u.roles?.some((r) => r === "ROLE_STAFF" || r === "ROLE_ADMIN"),
        );
        setStaffUsers(filtered.length ? filtered : MOCK_USERS);
      })
      .catch(() => !cancelled && setStaffUsers(MOCK_USERS));
    return () => {
      cancelled = true;
    };
  }, [fetchAuth]);

  // Orders
  useEffect(() => {
    let cancelled = false;
    setOrdersLoading(true);
    const qs = new URLSearchParams();
    if (tab !== "ALL") qs.set("status", tab);
    qs.set("page", "0");
    qs.set("size", "20");
    qs.set("sort", "createdAt,desc");
    fetchAuth(`/api/v1/admin/orders?${qs.toString()}`)
      .then(async (r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled) return;
        const arr: Order[] = Array.isArray(data) ? data : data?.content ?? [];
        const list = arr.length ? arr : MOCK_ORDERS;
        setOrders(tab === "ALL" ? list : list.filter((o) => o.status === tab));
      })
      .catch(() => {
        if (cancelled) return;
        setOrders(tab === "ALL" ? MOCK_ORDERS : MOCK_ORDERS.filter((o) => o.status === tab));
      })
      .finally(() => !cancelled && setOrdersLoading(false));
    return () => {
      cancelled = true;
    };
  }, [tab, fetchAuth]);

  const updateOrderStatus = async (order: Order, status: OrderStatus, staffNotes: string) => {
    try {
      const res = await fetchAuth(`/api/v1/admin/orders/${order.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, staffNotes }),
      });
      if (!res.ok && res.status !== 0) throw new Error("status");
    } catch {
      // fall through to optimistic update
    }
    const next = { ...order, status, staffNotes };
    setOrders((prev) => prev.map((o) => (o.id === order.id ? next : o)));
    setSelected(next);
    toast.success(`Order moved to ${STATUS_LABEL[status]}`);
  };

  const assignOrder = async (order: Order, userId: string) => {
    try {
      await fetchAuth(`/api/v1/admin/orders/${order.id}/assign`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assignedTo: userId }),
      });
    } catch {
      /* optimistic */
    }
    const next = { ...order, assignedTo: userId };
    setOrders((prev) => prev.map((o) => (o.id === order.id ? next : o)));
    setSelected(next);
    toast.success("Assigned");
  };

  return (
    <main className="min-h-screen bg-background px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1400px]">
        <header className="mb-6">
          <h1 className="font-serif text-2xl text-foreground sm:text-3xl">Staff orders</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage live orders, payments and dispatch.
          </p>
        </header>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          <StatCard
            label="Orders today"
            value={stats?.ordersToday}
            loading={statsLoading}
            color="text-[#2d4a3e]"
          />
          <StatCard
            label="Pending payment"
            value={stats?.ordersPending}
            loading={statsLoading}
            color="text-[#c4622d]"
          />
          <StatCard
            label="In production"
            value={stats?.ordersInProduction}
            loading={statsLoading}
            color="text-[#a07850]"
          />
          <StatCard
            label="Revenue today"
            value={stats ? `KES ${formatKES(stats.revenueToday)}` : undefined}
            loading={statsLoading}
            color="text-[#2d4a3e]"
          />
        </div>

        {/* Tabs */}
        <div className="mt-6 -mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          <div className="flex min-w-max gap-1 border-b border-border">
            {TABS.map((t) => {
              const active = t.key === tab;
              return (
                <button
                  key={t.key}
                  onClick={() => setTab(t.key)}
                  className={`relative min-h-[48px] px-4 py-3 text-sm transition ${
                    active
                      ? "font-semibold text-[#2d4a3e]"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {t.label}
                  {active && (
                    <span className="absolute inset-x-2 -bottom-px h-0.5 bg-[#2d4a3e]" />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Layout: table + slide panel */}
        <div className="mt-4 flex gap-4">
          <div className={`flex-1 ${selected ? "lg:pr-2" : ""}`}>
            <OrdersTable
              orders={orders}
              loading={ordersLoading}
              onSelect={setSelected}
            />
          </div>
          {selected && (
            <DetailPanel
              order={selected}
              staffUsers={staffUsers}
              onClose={() => setSelected(null)}
              onUpdateStatus={updateOrderStatus}
              onAssign={assignOrder}
            />
          )}
        </div>
      </div>
    </main>
  );
}

function StatCard({
  label,
  value,
  loading,
  color,
}: {
  label: string;
  value?: number | string;
  loading: boolean;
  color: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-4 shadow-sm sm:p-5">
      <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className="mt-2">
        {loading ? (
          <Skeleton className="h-8 w-24" />
        ) : (
          <div className={`font-serif text-2xl sm:text-3xl ${color}`}>{value ?? "—"}</div>
        )}
      </div>
    </div>
  );
}

function OrdersTable({
  orders,
  loading,
  onSelect,
}: {
  orders: Order[];
  loading: boolean;
  onSelect: (o: Order) => void;
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[800px] text-sm">
          <thead className="bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-4 py-3 text-left">Reference</th>
              <th className="px-4 py-3 text-left">Customer</th>
              <th className="px-4 py-3 text-left">Items</th>
              <th className="px-4 py-3 text-left">Total</th>
              <th className="px-4 py-3 text-left">Payment</th>
              <th className="px-4 py-3 text-left">Date</th>
              <th className="px-4 py-3 text-left">Status</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <tr key={i} className="border-t border-border">
                  {Array.from({ length: 8 }).map((__, j) => (
                    <td key={j} className="px-4 py-4">
                      <Skeleton className="h-4 w-full" />
                    </td>
                  ))}
                </tr>
              ))
            ) : orders.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-12 text-center text-sm text-muted-foreground">
                  No orders in this status
                </td>
              </tr>
            ) : (
              orders.map((o) => {
                const fullName =
                  o.customer.name ||
                  `${o.customer.firstName ?? ""} ${o.customer.lastName ?? ""}`.trim() ||
                  "Customer";
                return (
                  <tr
                    key={o.id}
                    onClick={() => onSelect(o)}
                    className="cursor-pointer border-t border-border transition hover:bg-muted/30"
                  >
                    <td className="px-4 py-4">
                      <span className="font-mono text-sm font-bold text-[#c4622d]">
                        {o.reference}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <div className="font-medium text-foreground">{fullName}</div>
                      <div className="text-xs text-muted-foreground">{maskEmail(o.customer.email)}</div>
                    </td>
                    <td className="px-4 py-4 text-muted-foreground">
                      {o.itemCount ?? o.items.length} items
                    </td>
                    <td className="px-4 py-4 font-medium text-foreground">
                      KES {formatKES(o.total)}
                    </td>
                    <td className="px-4 py-4">
                      <PaymentBadge method={o.paymentMethod} />
                    </td>
                    <td className="px-4 py-4 text-muted-foreground">{relTime(o.createdAt)}</td>
                    <td className="px-4 py-4">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_COLOR[o.status]}`}
                      >
                        {STATUS_LABEL[o.status]}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelect(o);
                        }}
                      >
                        View →
                      </Button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function PaymentBadge({ method }: { method: Order["paymentMethod"] }) {
  const map = {
    MPESA: "bg-green-100 text-green-700",
    BANK: "bg-blue-100 text-blue-700",
    COD: "bg-[#a07850]/15 text-[#a07850]",
  };
  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${map[method]}`}>
      {method}
    </span>
  );
}

function DetailPanel({
  order,
  staffUsers,
  onClose,
  onUpdateStatus,
  onAssign,
}: {
  order: Order;
  staffUsers: StaffUser[];
  onClose: () => void;
  onUpdateStatus: (o: Order, s: OrderStatus, n: string) => Promise<void>;
  onAssign: (o: Order, userId: string) => Promise<void>;
}) {
  const { whatsappNumber } = useSiteConfig();
  const [nextStatus, setNextStatus] = useState<OrderStatus | "">("");
  const [notes, setNotes] = useState(order.staffNotes ?? "");
  const [editingNotes, setEditingNotes] = useState(false);
  const [savingStatus, setSavingStatus] = useState(false);

  useEffect(() => {
    setNextStatus("");
    setNotes(order.staffNotes ?? "");
    setEditingNotes(false);
  }, [order.id, order.staffNotes]);

  const validNexts = NEXT_STATUSES[order.status];
  const fullName =
    order.customer.name ||
    `${order.customer.firstName ?? ""} ${order.customer.lastName ?? ""}`.trim() ||
    "Customer";

  const subtotal = order.subtotal ?? order.items.reduce((s, i) => s + i.lineTotal, 0);
  const delivery = order.deliveryFee ?? Math.max(0, order.total - subtotal);

  const phoneClean = order.customer.phone?.replace(/[^0-9]/g, "") ?? "";

  return (
    <>
      {/* Mobile overlay */}
      <div
        onClick={onClose}
        className="fixed inset-0 z-40 bg-black/40 lg:hidden"
        aria-hidden="true"
      />
      <aside className="fixed inset-x-0 bottom-0 top-0 z-50 w-full overflow-y-auto bg-background lg:static lg:inset-auto lg:z-auto lg:w-[400px] lg:flex-shrink-0 lg:rounded-lg lg:border lg:border-border lg:shadow-sm">
        <div className="sticky top-0 z-10 flex items-start justify-between border-b border-border bg-card px-5 py-4">
          <div>
            <div className="font-mono text-lg font-bold text-[#c4622d]">{order.reference}</div>
            <div className="mt-1.5 flex items-center gap-2">
              <span
                className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_COLOR[order.status]}`}
              >
                {STATUS_LABEL[order.status]}
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="-mr-2 flex h-10 w-10 items-center justify-center rounded-md hover:bg-muted"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4 px-5 py-5">
          {/* Status update */}
          {validNexts.length > 0 && (
            <Section title="Update status">
              <Select value={nextStatus} onValueChange={(v) => setNextStatus(v as OrderStatus)}>
                <SelectTrigger className="min-h-[44px]">
                  <SelectValue placeholder="Choose next status" />
                </SelectTrigger>
                <SelectContent>
                  {validNexts.map((s) => (
                    <SelectItem key={s} value={s}>
                      {STATUS_LABEL[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Staff notes (optional)"
                rows={2}
                className="mt-3"
              />
              <Button
                disabled={!nextStatus || savingStatus}
                onClick={async () => {
                  if (!nextStatus) return;
                  setSavingStatus(true);
                  await onUpdateStatus(order, nextStatus, notes);
                  setSavingStatus(false);
                }}
                className="mt-3 w-full bg-[#2d4a3e] text-[#f5f0e8] hover:bg-[#2d4a3e]/90"
              >
                {savingStatus ? "Updating…" : "Update"}
              </Button>
            </Section>
          )}

          {/* Assignee */}
          <Section title="Assign to">
            <Select
              value={order.assignedTo ?? ""}
              onValueChange={(v) => onAssign(order, v)}
            >
              <SelectTrigger className="min-h-[44px]">
                <SelectValue placeholder="Unassigned" />
              </SelectTrigger>
              <SelectContent>
                {staffUsers.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.firstName} {u.lastName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Section>

          {/* Customer */}
          <Section title="Customer">
            <div className="space-y-1.5 text-sm">
              <div className="font-medium text-foreground">{fullName}</div>
              <a href={`mailto:${order.customer.email}`} className="flex items-center gap-2 text-muted-foreground hover:text-foreground">
                <Mail className="h-4 w-4" />
                {order.customer.email}
              </a>
              {order.customer.phone && (
                <div className="text-muted-foreground">{order.customer.phone}</div>
              )}
              {order.customer.address && (
                <div className="text-muted-foreground">
                  {order.customer.address}
                  {order.customer.county ? `, ${order.customer.county}` : ""}
                </div>
              )}
            </div>
            {phoneClean && (
              <div className="mt-3 flex gap-2">
                <a
                  href={`tel:${phoneClean}`}
                  className="inline-flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-md border border-border px-3 py-2 text-sm font-medium hover:bg-muted"
                >
                  <Phone className="h-4 w-4" /> Call
                </a>
                {whatsappNumber && (
                  <a
                    href={`https://wa.me/${phoneClean.startsWith("254") ? phoneClean : `254${phoneClean.replace(/^0/, "")}`}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-md bg-[#25D366] px-3 py-2 text-sm font-medium text-white hover:opacity-90"
                  >
                    <MessageCircle className="h-4 w-4" /> WhatsApp
                  </a>
                )}
              </div>
            )}
          </Section>

          {/* Items */}
          <Section title="Order items">
            <div className="space-y-3 text-sm">
              {order.items.map((it, idx) => (
                <div key={idx} className="border-b border-border pb-2 last:border-b-0 last:pb-0">
                  <div className="font-medium text-foreground">{it.productName}</div>
                  {(it.size || it.material || it.finish) && (
                    <div className="text-xs text-muted-foreground">
                      {[it.size, it.material, it.finish].filter(Boolean).join(" • ")}
                    </div>
                  )}
                  <div className="mt-1 flex justify-between text-xs text-muted-foreground">
                    <span>
                      {it.quantity} × KES {formatKES(it.unitPrice)}
                    </span>
                    <span className="font-medium text-foreground">
                      KES {formatKES(it.lineTotal)}
                    </span>
                  </div>
                </div>
              ))}
              <div className="space-y-1 pt-2 text-sm">
                <Row label="Subtotal" value={`KES ${formatKES(subtotal)}`} />
                <Row label="Delivery" value={`KES ${formatKES(delivery)}`} />
                <div className="mt-2 flex justify-between border-t border-border pt-2 font-semibold text-foreground">
                  <span>Total</span>
                  <span>KES {formatKES(order.total)}</span>
                </div>
              </div>
            </div>
          </Section>

          {/* Payment */}
          <Section title="Payment">
            <div className="space-y-2 text-sm">
              <PaymentBadge method={order.paymentMethod} />
              {order.paymentMethod === "MPESA" && (
                <div className="text-muted-foreground">
                  {order.paymentReceipt
                    ? `Receipt: ${order.paymentReceipt}`
                    : "Awaiting payment"}
                </div>
              )}
              {order.paymentMethod === "BANK" && (
                <div className="text-muted-foreground">
                  {order.paymentProof
                    ? `Proof uploaded: ${order.paymentProof}`
                    : "Awaiting proof"}
                </div>
              )}
              {order.paymentMethod === "COD" && (
                <div className="text-muted-foreground">
                  Collect KES {formatKES(order.total)} on delivery
                </div>
              )}
            </div>
          </Section>

          {/* Staff notes */}
          <Section title="Staff notes">
            {editingNotes ? (
              <>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                />
                <div className="mt-2 flex gap-2">
                  <Button
                    size="sm"
                    onClick={async () => {
                      await onUpdateStatus(order, order.status, notes);
                      setEditingNotes(false);
                    }}
                    className="bg-[#2d4a3e] text-[#f5f0e8] hover:bg-[#2d4a3e]/90"
                  >
                    Save
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setEditingNotes(false)}>
                    Cancel
                  </Button>
                </div>
              </>
            ) : (
              <>
                <p className="text-sm text-muted-foreground">
                  {order.staffNotes || "No notes yet."}
                </p>
                <button
                  onClick={() => setEditingNotes(true)}
                  className="mt-2 text-xs font-medium text-[#2d4a3e] hover:underline"
                >
                  Edit
                </button>
              </>
            )}
          </Section>
        </div>
      </aside>
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
      <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {title}
      </div>
      {children}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-muted-foreground">
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}

// Silence unused import warning when memoizing helpers below in future
void useMemo;

export default StaffPage;
