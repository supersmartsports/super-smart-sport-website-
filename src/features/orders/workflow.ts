/**
 * The order workflow. The database holds the authoritative copy (order_status_transitions) and
 * refuses any other move; this mirror lets the interface offer only the valid next steps.
 * A test checks that the two are identical.
 */
export const ORDER_STATUSES = [
  "new_inquiry",
  "quotation_prepared",
  "quotation_accepted",
  "awaiting_deposit",
  "design_approval",
  "order_confirmed",
  "materials_preparation",
  "production_started",
  "quality_inspection",
  "production_completed",
  "ready_for_dispatch",
  "shipped",
  "delivered",
  "completed",
  "cancelled",
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  new_inquiry: "New Inquiry",
  quotation_prepared: "Quotation Prepared",
  quotation_accepted: "Quotation Accepted",
  awaiting_deposit: "Awaiting Deposit",
  design_approval: "Design Approval",
  order_confirmed: "Order Confirmed",
  materials_preparation: "Materials Preparation",
  production_started: "Production Started",
  quality_inspection: "Quality Inspection",
  production_completed: "Production Completed",
  ready_for_dispatch: "Ready for Dispatch",
  shipped: "Shipped",
  delivered: "Delivered",
  completed: "Completed",
  cancelled: "Cancelled",
};

const CANCELLABLE: OrderStatus[] = [
  "new_inquiry", "quotation_prepared", "quotation_accepted", "awaiting_deposit", "design_approval", "order_confirmed",
  "materials_preparation", "production_started", "quality_inspection", "production_completed", "ready_for_dispatch",
];

const FORWARD: Partial<Record<OrderStatus, OrderStatus[]>> = {
  new_inquiry: ["quotation_prepared"],
  quotation_prepared: ["quotation_accepted"],
  quotation_accepted: ["awaiting_deposit", "design_approval"],
  awaiting_deposit: ["design_approval"],
  design_approval: ["order_confirmed"],
  order_confirmed: ["materials_preparation"],
  materials_preparation: ["production_started"],
  production_started: ["quality_inspection"],
  quality_inspection: ["production_completed", "production_started"], // back to production = rework
  production_completed: ["ready_for_dispatch"],
  ready_for_dispatch: ["shipped"],
  shipped: ["delivered"],
  delivered: ["completed"],
};

export function nextStatuses(from: OrderStatus): OrderStatus[] {
  return [...(FORWARD[from] ?? []), ...(CANCELLABLE.includes(from) ? (["cancelled"] as OrderStatus[]) : [])];
}

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return nextStatuses(from).includes(to);
}

/** Every allowed move as "from>to", for comparing with the database. */
export function allTransitions(): string[] {
  return ORDER_STATUSES.flatMap((from) => nextStatuses(from).map((to) => `${from}>${to}`)).sort();
}

/** How far along an order is, 0 to 100. Cancelled orders report 0. */
export function orderProgress(status: OrderStatus): number {
  if (status === "cancelled") return 0;
  const steps = ORDER_STATUSES.length - 2; // "completed" is 100; "cancelled" is not a step
  return Math.round((ORDER_STATUSES.indexOf(status) / steps) * 100);
}
