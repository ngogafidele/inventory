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
