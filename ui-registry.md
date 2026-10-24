### Sale Return Status Badge

File: components/sales/sales-manager.tsx
Last updated: 2026-08-22

| Property | Class |
| --- | --- |
| Background | `bg-sky-500/10` |
| Border | `border border-sky-500/30` |
| Border radius | `rounded-full` |
| Text - primary | `text-xs font-semibold text-sky-700` |
| Text - secondary | `text-muted-foreground` |
| Spacing | `px-2 py-0.5`, parent `gap-1.5` |
| Hover state | none |
| Shadow | none |
| Accent usage | Sky accent indicates a return state separate from payment status. |

**Pattern notes:**
Return badges sit under the payment badge inside the existing sale Status cell.
Use `Returned` for fully returned sales and `Partially returned` when only some
sold quantity has been returned. Keep the badge compact so dense sales tables
remain scannable.

### Dashboard Metric Cards

File: components/dashboard/dashboard-stats.tsx
Last updated: 2026-08-28

| Property | Class |
| --- | --- |
| Background | Per-metric soft accent backgrounds such as `bg-violet-50`, `bg-emerald-50`, `bg-green-50` |
| Border | `border` plus matching soft accent borders such as `border-violet-200` |
| Border radius | `rounded-2xl` |
| Text - primary | `text-2xl font-semibold` |
| Text - secondary | `text-xs uppercase leading-4 tracking-[0.12em] opacity-70` |
| Spacing | Card `p-4`, page section `space-y-14`, grid `gap-x-5 gap-y-12` |
| Hover state | none |
| Shadow | `shadow-sm` |
| Accent usage | Each metric uses a distinct soft color pair and a matching Lucide icon color. |

**Pattern notes:**
Dashboard cards remain the same visual component for admin and restricted users.
Restricted users see only the approved eight cards, while admin users keep the
full metric set and the supporting activity tables. Keep the restricted UI in
step with `app/api/dashboard/stats/route.ts`, which returns only the approved
dashboard metrics for non-admin sessions.
### Product Edit Review

File: components/products/products-manager.tsx
Last updated: 2026-10-24

| Property | Class |
| --- | --- |
| Comparison background | `bg-muted/40` |
| Border | `border border-border/80` |
| Radius | `rounded-lg` |
| Spacing | `p-3`, form `gap-3` |
| Secondary text | `text-xs text-muted-foreground` |
| Pending notice | `border-warning/30 bg-warning/10 text-warning` |
| Actions | Existing `Button` outline, primary, and destructive variants |

**Pattern notes:** Reuse the product dialog and Table primitives. Show current
and requested values above the editable proposal, with an explicit approval
button. Label queue entries as New product or Product edit. Hide quantity inputs
for edit requests and show Unchanged in their opening-stock column.
### Approval Notifications

File: components/layout/loan-notifications.tsx
Last updated: 2026-10-24

| Property | Class |
| --- | --- |
| Panel | `bg-popover text-popover-foreground rounded-xl border border-border shadow-xl` |
| Entry spacing | `gap-3 px-4 py-3` |
| Entry hover | `hover:bg-muted/70` |
| Approval icon | `rounded-lg bg-warning/10 text-warning` |
| Product name | `text-sm font-semibold` |
| Request metadata | `text-xs text-muted-foreground` |

**Pattern notes:** Approvals share the header bell and total badge with loans.
Use a separate Awaiting approval section and retain the existing loan styles.
Each entry links directly to the review form; View all requests opens Products.
