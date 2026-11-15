# Financial methodology

Every figure on the dashboard and in reports is computed from stored ledger rows. Nothing is typed in, estimated or hard-coded.
The rules below are enforced in the database (`database/migrations`), repeated as pure functions in `src/lib/finance`, and
checked against each other by tests (`tests/integration`, `tests/unit/finance.test.ts`).

## Definitions

| Term | Definition |
| --- | --- |
| Net sales revenue | Order total after discount, minus pass-through tax, for orders dated in the period. Shipping charged to the customer is part of the order total. Cancelled orders are excluded. |
| Cash received | Confirmed payments minus confirmed refunds. Pending, failed and unconfirmed entries count as zero. A deposit never counts as the whole order. |
| Amount due | Order total, plus debit notes, minus credit notes. |
| Outstanding balance | Amount due minus cash received. |
| Direct costs | Order costs of class "direct": materials, labour, printing, stitching or bonding, packaging. |
| Gross profit | Net sales revenue minus direct costs. |
| Contribution margin | Gross profit minus additional order costs (shipping paid, payment fees, other order-related costs). |
| Operating expenses | Expenses in operating categories (office, marketing, utilities, equipment, other). |
| Net profit | Contribution margin minus unassigned manufacturing expenses minus operating expenses. |

**Estimated vs actual.** Profit figures are actual (recorded costs, confirmed cash). "Value of orders still open" is shown separately as
the pipeline; it is never added to revenue or profit.

## No double counting

- A payment counts once, and only after someone with the `payments.confirm` permission confirms it. A confirmed payment is frozen and cannot be deleted.
- An expense is counted once. The part assigned to orders (as order costs) appears in order costs; only the unassigned remainder appears as an expense.
  A trigger refuses to assign more than the expense's amount in total.
- Voided expenses and voided order costs stay on record but are excluded from every total.

## Currencies

- Every amount is stored with its own currency and an explicit exchange rate to the reporting currency, fixed when it is recorded.
- Orders in a foreign currency must carry an explicit rate before they can be confirmed.
- There is no default or silent conversion: code that tries to add different currencies raises an error, and the dashboard shows money grouped by currency.
- The reporting currency is a business setting (`business_settings.reporting_currency`).

## Shared expenses (overhead allocation)

Operating expenses are spread over orders in the reporting period in proportion to net sales revenue (default) or direct cost,
chosen in Settings. The largest-remainder method is used, so the shares always add up to exactly the total: no cent is lost or invented.

## Corrections keep history

| Record | How it is corrected |
| --- | --- |
| Payment | Frozen once confirmed. Record a refund as a separate confirmed entry. |
| Invoice | Frozen once finalized. Use credit or debit notes (append-only) or void it with a reason. |
| Expense | Amount, currency, date and category are fixed. Void it and enter a new one. |
| Order status | Only `change_order_status()` moves an order, and it records who, when, from and to. History is append-only. |
| Stock | Quantity on hand is the sum of append-only movements. It cannot go negative. |
| Anything | Every change to a business table is written to the audit log with before and after values. The audit log cannot be edited or deleted. |
