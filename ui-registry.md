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
