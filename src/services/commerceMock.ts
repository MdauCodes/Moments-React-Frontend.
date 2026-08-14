// ----------------------------------------------------------------------------
// Type-only module. Mock data has been removed — all admin commerce data now
// comes from the live backend via commerceApi.ts.
// ----------------------------------------------------------------------------

// Matches backend: com.mdau...order.entity.OrderStatus
export type OrderStatus =
  | "PENDING_PAYMENT"
  | "PAID"
  | "PAYMENT_VERIFIED"
  | "IN_PRODUCTION"
  | "READY_FOR_DISPATCH"
  | "DISPATCHED"
  | "DELIVERED"
  | "CANCELLED"
  | "REFUNDED";

// Matches backend: com.mdau...order.entity.PaymentStatus
export type PaymentStatus = "PENDING" | "PAID" | "FAILED" | "REFUNDED";

// Matches backend: com.mdau...order.entity.PaymentMethod
export type PaymentGateway = "PAYHERO" | "MPESA" | "BANK_TRANSFER" | "CASH_ON_DELIVERY";

export interface OrderItem {
  productId: string;
  name: string;
  qty: number;
  unitPrice: number;
  imageUrl?: string;
  category?: string;
  size?: string;
  material?: string;
  finish?: string;
  lineTotal?: number;
}

export interface OrderRecord {
  id: string;
  reference: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  paymentGateway: PaymentGateway;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  shippingAddress: string;
  city: string;
  county?: string;
  postalCode?: string;
  items: OrderItem[];
  subtotal: number;
  shippingFee: number;
  discount?: number;
  total: number;
  currency: "KES";
  createdAt: string;
  updatedAt: string;
  trackingNumber?: string;
  notes?: string;
  staffNotes?: string;
  assignedTo?: string;
  assignedToId?: string;
  contentsVerified?: boolean;
  deliveryConfirmationStatus?: string;
  vatAmount?: number;
  taxableAmount?: number;
  vatRate?: number;
  etrRequested?: boolean;
  documentsEmail?: string;
  courierType?: string;
  courierServiceName?: string;
  courierStageOrOffice?: string;
  promoCode?: string;
  paymentMethod?: string;
  fulfillmentType?: string;
  /** Sandbox/test-mode system — true only for orders placed by a designated internal test
   *  account. Never real revenue; shown as a "TEST" badge, filterable in the Orders list. */
  isTestOrder?: boolean;
  /** Manual Delivery fee — agreed by phone after placement, never charged at checkout. */
  deliveryFeeAmount?: number;
  deliveryFeeStatus?: "UNPAID" | "PENDING_STK" | "PAID";
  deliveryFeeMethod?: "SELF_PAID" | "ADMIN_STK" | "MANUAL_RECORD";
  /** TumaBoda-fulfilled delivery visibility. */
  tumabodaStatus?: string;
  /** Null on a paid TUMABODA_DELIVERY order means delivery creation failed at payment time and
   *  never retried — see AdminOrderController's retry-tumaboda-delivery action. */
  tumabodaDeliveryId?: string;
  tumabodaDeliveryNumber?: string;
  tumabodaCost?: number;
  /** Set when the customer self-confirms receipt on the track-order page — see
   *  OrderService.confirmDelivery. Distinct from any courier/staff-driven status. */
  customerConfirmedDeliveredAt?: string;
  refundRequestedAt?: string;
  refundRequestReason?: string;
  refundRequestedBy?: string;
  refundResolvedAt?: string;
  statusHistory?: {
    id?: string;
    fromStatus?: string;
    toStatus: string;
    note?: string;
    changedBy?: string;
    changedAt: string;
  }[];
}

export interface PaymentRecord {
  id: string;
  reference: string;
  orderReference: string;
  gateway: PaymentGateway;
  status: PaymentStatus;
  amount: number;
  currency: "KES";
  customerName: string;
  customerPhone?: string;
  gatewayReference?: string;
  failureReason?: string;
  createdAt: string;
}

export interface DashboardStats {
  revenueToday: number;
  revenueYesterday: number;
  revenue7d: number;
  revenue30d: number;
  ordersToday: number;
  ordersPending: number;
  ordersFailed: number;
  paymentSuccessRate24h: number;
  lowStockCount: number;
  newCustomers7d: number;
  averageOrderValue7d: number;
  revenueSeries7d: { date: string; revenue: number; orders: number }[];
  topProducts: { productId: string; name: string; unitsSold: number; revenue: number }[];
  recentOrders: OrderRecord[];
  failedPayments: PaymentRecord[];
  lowStockProducts: { productId: string; name: string; stock: number; threshold: number }[];
}

export interface CustomerRecord {
  id: string;
  name: string;
  email: string;
  phone: string;
  city: string;
  segment: "RETAIL" | "WHOLESALE" | "ENTERPRISE";
  status: "VIP" | "ACTIVE" | "AT_RISK" | "DORMANT";
  lifetimeValue: number;
  ordersCount: number;
  lastOrderAt?: string;
  firstOrderAt?: string;
  averageOrderValue?: number;
  defaultAddress?: string;
  createdAt: string;
  accountType?: "INDIVIDUAL_SHOPPER" | "BUSINESS";
  rewardsPoints?: number | null;
  /** Sandbox/test-mode system — a Super-Admin-designated internal account. Any order this
   *  customer places routes to sandbox gateways and is excluded from all reporting. */
  isTestAccount?: boolean;
}
