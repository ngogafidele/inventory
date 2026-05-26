# B Ikaze Inventory - System Reference

## 1. Purpose

B Ikaze Inventory supports the operation of two physical retail branches:
**Gisozi** and **Kinyinya**. The system records stock movement, sales revenue,
credit exposure, expenses, and printable customer or management documents.

This document describes implemented behavior. It is intended for product
owners, operators, support staff, and engineers maintaining the application.

## 2. Business Model

The business earns income by selling stocked products at a selling price above
their recorded cost. It also offers customer credit through unpaid sales
referred to in the interface as loans.

The primary financial relationships are:

```text
Net revenue = recorded sales - recorded returns
Gross profit = net revenue - cost of goods represented by sold/returned items
Operating profit = gross profit - recorded expenses
Receivables = unpaid loan sales awaiting collection
```

## 3. Branch Model

| Key | Branch | PDF Address |
| --- | --- | --- |
| `store1` | Gisozi | Kigali, Gisozi |
| `store2` | Kinyinya | Kigali, Kinyinya |

Branch separation is a core control:

- Products and on-hand quantities are branch-specific.
- Sales, returns, invoices, expenses, alerts, and adjustments belong to one
  branch.
- Dashboards, reports, notification queries, and PDFs operate on the active
  permitted branch.
- Invoice and proforma sequences are generated per branch and calendar period.

## 4. User Roles

### Administrator

The administrator can operate across both stores and access restricted
management functionality, including the dashboard, reports, user management,
stock adjustments, product administration, and corrective sale deletion.

### Manager And Staff

Non-admin users operate against their assigned store. They have access to
daily business workflows exposed by the interface, such as products, sales,
returns, billing, expenses, loans, and alerts. Specific management actions are
limited by authorization checks in the route handlers and UI.

### Sessions

- Authentication is stored in an HTTP-only JWT cookie.
- The session records the user, role, permitted stores, and selected store.
- Admin idle timeout is one hour; staff idle timeout is six hours.
- Requests refresh active sessions and reject expired or inactive users.

## 5. Functional Modules

### Products And Stock

A product records branch ownership, SKU, unit, quantity, low-stock threshold,
cost price, and selling price. Product names and SKUs are unique within each
branch.

Inventory changes occur through:

- Sales, which deduct quantity.
- Returns, which restore quantity.
- Admin stock adjustments, which record a reason and add or remove quantity.
- Corrective deletion of a sale, which restores its sold quantity.

Low-stock alerts are synchronized after inventory-changing operations.

### Sales

A sale contains one or more item snapshots. Snapshotting prices and product
descriptions preserves the commercial record even if the product master is
changed later.

Paid sales require a payment method:

- Cash
- Bank
- Mobile money

Unpaid sales carry receivable details:

- Customer name
- Customer phone number
- Expected payment date

Sales edit and deletion operations reconcile inventory and prevent negative
stock. Editing a sale that has an invoice also updates the related invoice
items and total.

### Loans And Collections

The Loans view represents unpaid sales, not a separate loan ledger. This is
important operationally: goods leave stock when the unpaid sale is recorded,
not when the money is later collected.

Users can:

- Search outstanding customers by name or phone number.
- Download a customer statement PDF.
- Mark a balance as paid and capture the payment method.

Administrators can delete an unpaid loan as a correction. Deletion restores
stock and is rejected if the sale already has an invoice.

Loan notifications identify accounts due today or already overdue and refresh
when relevant sales are created, settled, or deleted.

### Returns

Returns restore returned product quantities to inventory and are included as
reductions to revenue and gross profit. The data model also supports
replacement items for exchange-related workflows.

### Invoices And Proformas

Sales invoices formalize a recorded sale for a customer. Proformas represent
pre-sale or quotation documents and can be created from sale data or entered
items.

Documents are numbered by branch and month:

```text
INV-YYYYMM-NNNN
PF-YYYYMM-NNNN
```

### Expenses

Expenses record branch-level operating costs with description, date, optional
category and notes, and payment method. Reports deduct expenses from gross
profit.

### Reports

Administrative reports provide:

- Revenue and cost of sales
- Expenses and profit
- Inventory cost and retail valuation
- Sales and product counts
- Outstanding loan value
- Product movement and recent sales

Reports use a selected date range and are available in both screen and PDF
form.

## 6. Documents

The application produces these customer-facing or management PDFs:

| Document | Route Area | Branch Identity |
| --- | --- | --- |
| Sales invoice | `app/api/sales-invoices/[id]/pdf` | Active branch address |
| Proforma invoice | `app/api/proformas/[id]/pdf` | Active branch address |
| Product catalog | `app/api/products/catalog/pdf` | Active branch address |
| Outstanding statement | `app/api/outstanding/pdf` | Active branch address |
| Management report | `app/api/reports/pdf` | Active branch label |

All business date formatting and date-range boundaries use Kigali time.

## 7. Technical Architecture

### Rendering Boundary

Dashboard pages are Server Components that authenticate the request and load
store-scoped database records. Interactive manager components receive
serializable initial data and use route handlers for user-triggered changes.

### API Boundary

Route handlers under `app/api`:

- Authenticate the user.
- Resolve and authorize the requested store.
- Validate write payloads using Zod.
- Apply database operations.
- Return JSON or binary PDF responses.

### Persistence

MongoDB collections represented by Mongoose models include:

- `User` and `UserLoginLog`
- `Product` and `Category`
- `Sale` and `Return`
- `Invoice` and `Proforma`
- `Expense`
- `StockAdjustment`
- `Alert`
- `NumberSequence`
- `PasswordResetToken`

## 8. Directory Guide

| Directory | Responsibility |
| --- | --- |
| `app/(dashboard)` | Authenticated pages and server-side data composition |
| `app/api` | Route handlers for data operations and generated documents |
| `components` | Interactive application features and reusable UI |
| `lib/auth` | Authentication, sessions, store access, and permissions |
| `lib/db/models` | Persisted data models |
| `lib/db/validators` | Incoming payload validation |
| `lib/pdf` | PDF rendering implementations |
| `lib/utils` | Shared business formatting, time, sequence, and constants |
| `types` | Cross-layer contracts |

## 9. Maintenance Rules

- Preserve store scoping on every query and mutation.
- Preserve stock reconciliation when changing sale or return behavior.
- Keep financial calculation changes consistent between screen reports and PDF
  reports.
- Keep document branch identity aligned with the selected store.
- Use Kigali time utilities for business dates, due dates, and reporting
  boundaries.
- Review the installed Next.js documentation in `node_modules/next/dist/docs/`
  before changing framework-facing patterns.
