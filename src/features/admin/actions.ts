"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createUserClient } from "@/lib/database/server";
import { createServiceClient } from "@/lib/database/admin";
import { requirePermission, requireUser } from "@/server/auth";
import { hasPermission } from "@/features/auth/permissions";
import { canTransition, ORDER_STATUSES, type OrderStatus } from "@/features/orders/workflow";
import { moduleBySlug } from "./modules";
import { parseForm } from "./schema";

export type ActionState = { error?: string; ok?: string; fieldErrors?: Record<string, string> };

/** Database messages are written to be readable, so most can be shown as they are. */
function friendly(error: { message: string; code?: string }): string {
  if (error.code === "42501" || /row-level security|permission denied/i.test(error.message)) return "You do not have permission to do that.";
  if (error.code === "23505") return "A record with the same unique value already exists.";
  if (error.code === "23503") return "That record is linked to others and cannot be removed or pointed at something that does not exist.";
  if (error.code === "23514") return `A value is not allowed: ${error.message.replace(/^new row for relation .* violates check constraint /, "")}`;
  return error.message;
}

const configOrThrow = (slug: string) => {
  const config = moduleBySlug(slug);
  if (!config) throw new Error("Unknown module");
  return config;
};

/** Create or update a record. `id` is "new" for a new one. */
export async function saveRecord(slug: string, id: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const config = configOrThrow(slug);
  if (!config.write) return { error: "This module is read-only." };
  await requirePermission(config.write);

  const creating = id === "new";
  const { values, errors } = parseForm(config.fields, formData, creating ? "create" : "update");
  if (Object.keys(errors).length) return { error: "Please fix the highlighted fields.", fieldErrors: errors };

  const supabase = await createUserClient();

  // Payments, invoices and shipments take the customer (and an invoice its currency) from the chosen order.
  if (creating && config.derive === "from_order") {
    const { data: order } = await supabase.from("orders").select("customer_id, currency").eq("id", String(values.order_id)).maybeSingle();
    if (!order) return { error: "That order could not be found." };
    values.customer_id = order.customer_id;
    if (config.table === "invoices") values.currency = order.currency;
  }

  if (config.singleton) {
    const { error } = await supabase.from(config.table).update(values).eq(config.singleton.idColumn, config.singleton.idValue);
    if (error) return { error: friendly(error) };
    revalidatePath(`/admin/${slug}`);
    return { ok: "Saved." };
  }

  if (creating) {
    const { data, error } = await supabase.from(config.table).insert(values).select("id").single();
    if (error) return { error: friendly(error) };
    revalidatePath(`/admin/${slug}`);
    redirect(`/admin/${slug}/${data.id}`);
  }
  const { error } = await supabase.from(config.table).update(values).eq("id", id);
  if (error) return { error: friendly(error) };
  revalidatePath(`/admin/${slug}`);
  revalidatePath(`/admin/${slug}/${id}`);
  return { ok: "Saved." };
}

/** Buttons on a record: status changes, workflow steps and database functions (confirm payment, finalize invoice ...). */
export async function runAction(slug: string, id: string, index: number, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const config = configOrThrow(slug);
  const action = config.actions?.[index];
  if (!action) return { error: "Unknown action." };
  const user = await requireUser();
  if (!hasPermission(user, action.permission)) return { error: "You do not have permission to do that." };
  const supabase = await createUserClient();
  const done = (message: string): ActionState => {
    revalidatePath(`/admin/${slug}`);
    revalidatePath(`/admin/${slug}/${id}`);
    return { ok: message };
  };

  if (action.type === "order_status") {
    const to = String(formData.get("to") ?? "");
    if (!ORDER_STATUSES.includes(to as OrderStatus)) return { error: "Choose a status." };
    const { data: order } = await supabase.from("orders").select("status").eq("id", id).maybeSingle();
    if (!order) return { error: "Order not found." };
    if (!canTransition(order.status as OrderStatus, to as OrderStatus)) return { error: `An order cannot go from ${order.status} to ${to}.` };
    const note = String(formData.get("note") ?? "").trim().slice(0, 1000) || null;
    // The database function records who, when, from and to, and refuses any move the workflow does not allow.
    const { error } = await supabase.rpc("change_order_status", { p_order: id, p_to: to, p_note: note });
    return error ? { error: friendly(error) } : done("Status updated.");
  }

  if (action.type === "status") {
    const to = String(formData.get("to") ?? "");
    const { data: record } = await supabase.from(config.table).select("*").eq("id", id).maybeSingle();
    if (!record || !action.next(record).includes(to)) return { error: "That change is not allowed from the current status." };
    const { error } = await supabase.from(config.table).update({ [action.column]: to }).eq("id", id);
    return error ? { error: friendly(error) } : done("Status updated.");
  }

  if (action.type === "update") {
    const set = Object.fromEntries(Object.entries(action.set).map(([key, value]) => [key, value === "now" ? new Date().toISOString() : value]));
    const { error } = await supabase.from(config.table).update(set).eq("id", id);
    return error ? { error: friendly(error) } : done("Done.");
  }

  const args: Record<string, unknown> = { [action.idArg]: id };
  if (action.numberArg) {
    const raw = String(formData.get(action.numberArg.name) ?? "").trim();
    if (raw !== "") {
      if (!/^\d{1,12}(\.\d{1,2})?$/.test(raw)) return { error: "Enter the amount as a number such as 250.00." };
      args[action.numberArg.name] = raw;
    }
  }
  const { data, error } = await supabase.rpc(action.rpc, args);
  if (error) return { error: friendly(error) };
  if (action.rpc === "convert_quotation_to_order" && typeof data === "string") redirect(`/admin/orders/${data}`);
  return done("Done.");
}

/** Add a line item, note, task, movement ... to a record. */
export async function addChildRow(slug: string, parentId: string, childKey: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const config = configOrThrow(slug);
  const child = config.children?.find((c) => c.key === childKey);
  if (!child || !child.write) return { error: "Unknown section." };
  await requirePermission(child.write);
  const { values, errors } = parseForm(child.fields, formData, "create");
  if (Object.keys(errors).length) return { error: "Please fix the highlighted fields.", fieldErrors: errors };
  const supabase = await createUserClient();
  const row: Record<string, unknown> = { ...values, [child.fk]: parentId };
  // Shipment events use a date; store it at midday UTC so the day is the same in every time zone.
  if (child.table === "shipment_events" && typeof row.occurred_at === "string") row.occurred_at = `${row.occurred_at}T12:00:00Z`;
  const { error } = await supabase.from(child.table).insert(row);
  if (error) return { error: friendly(error) };
  revalidatePath(`/admin/${slug}/${parentId}`);
  return { ok: "Added." };
}

export async function deleteChildRow(slug: string, parentId: string, childKey: string, rowId: string): Promise<void> {
  const config = configOrThrow(slug);
  const child = config.children?.find((c) => c.key === childKey);
  if (!child || !child.write || !child.canDelete) return;
  await requirePermission(child.write);
  const supabase = await createUserClient();
  await supabase.from(child.table).delete().eq("id", rowId).eq(child.fk, parentId);
  revalidatePath(`/admin/${slug}/${parentId}`);
}

/** Creates an employee's login and profile. Needs the service key, so it checks the caller's permission first. */
export async function createEmployee(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requirePermission("employees.manage");
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const fullName = String(formData.get("full_name") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const roleId = String(formData.get("role_id") ?? "");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: "Enter a valid email address." };
  if (!fullName || fullName.length > 200) return { error: "Enter the employee's name." };
  if (password.length < 12) return { error: "The temporary password must be at least 12 characters. The employee should change it after signing in." };
  if (!/^[0-9a-f-]{36}$/.test(roleId)) return { error: "Choose a role." };

  const service = createServiceClient();
  const { data: created, error } = await service.auth.admin.createUser({ email, password, email_confirm: true });
  if (error || !created.user) return { error: error?.message ?? "The login could not be created." };
  const { error: profileError } = await service.from("profiles").insert({ id: created.user.id, full_name: fullName, email, role_id: roleId });
  if (profileError) {
    await service.auth.admin.deleteUser(created.user.id); // do not leave a login without a profile
    return { error: profileError.message };
  }
  revalidatePath("/admin/employees");
  redirect(`/admin/employees/${created.user.id}`);
}
