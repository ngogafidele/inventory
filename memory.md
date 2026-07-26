# Memory — Inventory/POS: review fixes, soft-delete, sale-linked returns, payment cards

Last updated: 2026-07-26

## Context / stack
- Next.js 16 + React 19, MongoDB via Mongoose, Tailwind v4 + shadcn, PDFKit, JWT auth.
- **This Next.js has breaking changes** — `middleware` is renamed to `proxy` (`proxy.ts`). Read `node_modules/next/dist/docs/` before writing framework code (per AGENTS.md).
- Multi-tenant by `store` ("store1"/"store2"); every query is store-scoped. A "loan" = a `Sale` with `paymentStatus:"unpaid"` + `outstanding` sub-doc (no separate model); shown on `/outstanding`.
- **Verification method used all session**: `npx tsc --noEmit | grep -c "error TS"`. Baseline is **25 pre-existing errors** (masked by `typescript.ignoreBuildErrors:true` in `next.config.ts`). Goal each change = keep count at 25 (zero net new). Could NOT run the app (no browser/DB here) — everything verified by types + reasoning only.

## What was built (this session, in order)
1. **/review of whole project** — foundation is strong (auth, multi-tenancy, transactional stock). Findings logged below under Open questions.
2. **Fixed 3 "Important" review issues**: installed `@types/bcrypt` + `@types/jsonwebtoken`; added semantic `--success`/`--warning` tokens to `app/globals.css` and replaced raw amber/emerald/green/rose status classes across ~8 components (sales-manager, invoices/sales-list, stock-adjustments-manager, products-manager, product-monitor-dialog, layout/loan-notifications, returns-manager, reset-password-form); fixed a latent `undefined` deref in `app/api/sales/route.ts` (transaction now `return`s the created sale).
3. **Soft delete for sales & loans**: `deletedAt`/`deletedBy` on `Sale` + `Invoice` (models) with indexes. `DELETE /api/sales/[id]` now soft-deletes (restocks, soft-deletes linked invoice). New `POST /api/sales/[id]/restore` (admin) re-deducts stock in a txn (errors on insufficient/missing), revives sale+invoice. Guards added to PUT/PATCH/payments/invoice-create/proforma/PDF against deleted sales. `deletedAt:null` added to ALL business-number queries (dashboard stats, reports page+PDF, invoices list, loan notifications, outstanding, customers-suppliers, product movements, sales GET). `/sales` and `/outstanding` show an admin-only read-only "Deleted" section with a **Restore** button (confirm via native confirm() in sales-manager, modal Dialog in outstanding-manager).
4. **Date-range filter** (From/To by sale `createdAt`, Kigali TZ via `formatKigaliDateInput`) on `/sales` and `/outstanding` — filters both active AND deleted lists; search also extended to deleted lists.
5. **Sale-linked returns** (fixes negative report revenue): `Return` gained `saleId` + denormalized `saleDate`. Recording a return now requires selecting a sale (returns-manager rewritten: sale dropdown → items with per-item returnable cap = sold − already-returned). POST/PUT validate against the sale. Reports (page + PDF) now net returns by `effectiveDate = $ifNull(saleDate, createdAt)` instead of the return's own date.
6. **Payment-method cards** (Cash/Bank/Mobile Money) on dashboard, reports page, AND reports PDF. Shared helper `lib/db/payments.ts` → `getPaymentMethodTotals(store, dateFilter)` = "all money actually collected" (paid sales w/ empty `payments[]` by method + every loan installment by method, no double-count). Also **closed the loan-settlement gap**: `PATCH /api/sales/[id]` now pushes the settled remainder into `payments[]` (method, paidAt=now, receivedBy) so direct settlements appear in the breakdown.

## Decisions made
- Soft delete: deleting **returns items to stock** (restore re-deducts, fails loudly if insufficient); linked **invoice soft-deleted too**; restore enabled; deleted section + delete/restore are **admin-only, read-only**. Excluded via explicit `deletedAt:null` at each site (NOT middleware) because aggregations dominate.
- `{deletedAt:null}` matches missing fields too, so existing docs need no backfill; deleted lists query `{deletedAt:{$ne:null}}`.
- Returns: chose **full sale link** (not a manual date field). `saleDate` denormalized so reports need no join and survive sale soft-delete. Existing (legacy) returns have no saleId → fall back to `createdAt` in reports; their edit is quantity-reduce-only.
- Payment cards: chose **"all money actually collected"** (cash-flow) over "paid sales only".
- Date filter attributes by **sale date** (createdAt), not payment/loan-due date.

## Current state
- All of the above is implemented and **type-clean at the 25-error baseline** (zero net new type errors). **Nothing has been committed** (working tree changes only). App not run/smoke-tested.

## Next session starts with
- Likely the **Critical review finding still open**: remove `typescript.ignoreBuildErrors:true` and clear the **25 pre-existing type errors** (mostly Mongoose `store: string` vs `"store1"|"store2"` overloads, `.lean()` `never` types in products/receipts + stock-adjustments routes, recharts `LabelFormatter`/`Formatter` casts in report-charts.tsx + stock-movement-charts.tsx, `connection.ts` MONGODB_URI narrowing). User was about to `/architect` this when they pivoted to soft-delete.
- OR: commit the session's work if the user wants (branch is `local`; main is `main`).

## Open questions / follow-ups offered but not done
- **Dashboard "today" returns & payment attribution** still use return date / today-createdAt; only the **reports** were switched to `saleDate` netting. Offered to extend to dashboard.
- Minor UI staleness: after restoring a sale that had an invoice, the sales-manager "Invoice" button can look available until a full reload (pre-existing `invoicedSaleIds` init-once pattern) — clicking just returns "Invoice already exists".
- Legacy returns (pre-migration, no saleId) editable by reducing quantities only — a small capability trim, flagged as acceptable.
- Everything needs a **manual browser/DB smoke test** (couldn't run here): delete→restore round-trip, cross-month return netting, settle→payment-breakdown, PDF layout with the 3 new cards.
- Other review findings not addressed: dead code (`useFetch`, `apiClient`, `useAlert`), redundant `components/navigation/sidebar.tsx` re-export, convoluted `canRecordSales` in `lib/auth/permissions.ts`.
