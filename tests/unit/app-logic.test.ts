import { beforeEach, describe, expect, it } from "vitest";
import { ADMIN_MODULES, hasPermission, PERMISSION_KEYS, visibleModules } from "@/features/auth/permissions";
import { allTransitions, canTransition, nextStatuses, ORDER_STATUSES, orderProgress } from "@/features/orders/workflow";
import { rateLimit, resetRateLimits } from "@/lib/utilities/rate-limit";
import { signInSchema } from "@/lib/validations/auth";
import { inquirySchema } from "@/lib/validations/inquiry";

describe("permissions", () => {
  it("shows a user only the modules their permissions allow", () => {
    const sales = { permissions: ["customers.read", "inquiries.read", "quotations.read", "orders.read"] };
    const keys = visibleModules(sales).map((m) => m.key);
    expect(keys).toEqual(["overview", "customers", "inquiries", "quotations", "orders"]);
    expect(keys).not.toContain("payments");
    expect(keys).not.toContain("profit");
    expect(hasPermission(sales, "payments.confirm")).toBe(false);
  });

  it("shows an employee with only assigned tasks the production module and nothing financial", () => {
    const keys = visibleModules({ permissions: ["tasks.read_assigned", "notifications.read"] }).map((m) => m.key);
    expect(keys).toEqual(["overview", "production", "notifications"]);
  });

  it("shows nothing to someone with no permissions", () => {
    expect(visibleModules({ permissions: [] })).toEqual([]);
  });

  it("lists all 21 modules, each guarded by real permission keys", () => {
    expect(ADMIN_MODULES).toHaveLength(21);
    for (const module of ADMIN_MODULES) {
      for (const key of module.anyOf) expect(PERMISSION_KEYS).toContain(key);
    }
  });
});

describe("order workflow", () => {
  it("has the 15 statuses in order", () => {
    expect(ORDER_STATUSES).toHaveLength(15);
    expect(ORDER_STATUSES[0]).toBe("new_inquiry");
    expect(ORDER_STATUSES.at(-1)).toBe("cancelled");
  });

  it("moves forward step by step and never skips", () => {
    expect(canTransition("design_approval", "order_confirmed")).toBe(true);
    expect(canTransition("order_confirmed", "shipped")).toBe(false);
    expect(canTransition("new_inquiry", "completed")).toBe(false);
    expect(canTransition("quality_inspection", "production_started")).toBe(true); // rework
  });

  it("cannot cancel once shipped, and finished orders are final", () => {
    expect(canTransition("ready_for_dispatch", "cancelled")).toBe(true);
    expect(canTransition("shipped", "cancelled")).toBe(false);
    expect(nextStatuses("completed")).toEqual([]);
    expect(nextStatuses("cancelled")).toEqual([]);
  });

  it("reports progress", () => {
    expect(orderProgress("new_inquiry")).toBe(0);
    expect(orderProgress("completed")).toBe(100);
    expect(orderProgress("cancelled")).toBe(0);
    expect(orderProgress("production_started")).toBeGreaterThan(orderProgress("order_confirmed"));
    expect(allTransitions().length).toBeGreaterThan(20);
  });
});

describe("rate limiting", () => {
  beforeEach(() => resetRateLimits());

  it("allows up to the limit, then blocks until the window ends", () => {
    for (let i = 0; i < 5; i += 1) expect(rateLimit("login:1.2.3.4", 5, 60_000, 1000).allowed).toBe(true);
    const blocked = rateLimit("login:1.2.3.4", 5, 60_000, 2000);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSeconds).toBe(59);
    expect(rateLimit("login:1.2.3.4", 5, 60_000, 61_001).allowed).toBe(true);
  });

  it("counts each key separately", () => {
    for (let i = 0; i < 6; i += 1) rateLimit("a", 5, 60_000, 0);
    expect(rateLimit("b", 5, 60_000, 0).allowed).toBe(true);
  });
});

describe("input validation", () => {
  it("sign-in needs a real email and a password", () => {
    expect(signInSchema.safeParse({ email: " Owner@Example.com ", password: "x" }).data?.email).toBe("owner@example.com");
    expect(signInSchema.safeParse({ email: "nope", password: "x" }).success).toBe(false);
    expect(signInSchema.safeParse({ email: "a@b.co", password: "" }).success).toBe(false);
  });

  it("an inquiry needs a name and one way to reply", () => {
    expect(inquirySchema.safeParse({ name: "Ann", email: "ann@example.com" }).success).toBe(true);
    expect(inquirySchema.safeParse({ name: "Ann", whatsapp: "+44 7700 900123" }).success).toBe(true);
    expect(inquirySchema.safeParse({ name: "Ann" }).success).toBe(false);
    expect(inquirySchema.safeParse({ name: "", email: "ann@example.com" }).success).toBe(false);
  });

  it("cleans and bounds inquiry fields", () => {
    const parsed = inquirySchema.parse({ name: "  Ann  ", email: "ANN@Example.com", quantity: "500", company: "", instructions: "x" });
    expect(parsed.name).toBe("Ann");
    expect(parsed.email).toBe("ann@example.com");
    expect(parsed.quantity).toBe(500);
    expect(parsed.company).toBeNull();
    expect(inquirySchema.safeParse({ name: "A", email: "a@b.co", quantity: "-5" }).success).toBe(false);
    expect(inquirySchema.safeParse({ name: "A", email: "a@b.co", whatsapp: "<script>" }).success).toBe(false);
    expect(inquirySchema.safeParse({ name: "A".repeat(201), email: "a@b.co" }).success).toBe(false);
    expect(inquirySchema.safeParse({ name: "A", email: "a@b.co", instructions: "x".repeat(4001) }).success).toBe(false);
  });
});
