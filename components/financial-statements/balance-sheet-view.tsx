"use client"

// Presents the balance sheet as of a date and edits its manual line items.
import { useCallback, useEffect, useState } from "react"
import { Pencil, Plus, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { formatCurrency } from "@/lib/utils/format"
import { formatKigaliDateInput } from "@/lib/utils/time"
import { cn } from "@/lib/utils"

type Category =
  | "current_asset"
  | "fixed_asset"
  | "current_liability"
  | "long_term_liability"
  | "equity"

const CATEGORY_LABELS: Record<Category, string> = {
  current_asset: "Current asset",
  fixed_asset: "Fixed asset",
  current_liability: "Current liability",
  long_term_liability: "Long-term liability",
  equity: "Equity",
}

type Line = {
  label: string
  amount: number
  source: "auto" | "manual"
  id?: string
  note?: string
}

type Sheet = {
  asOf: string
  assets: { current: Line[]; fixed: Line[]; total: number }
  liabilities: { current: Line[]; longTerm: Line[]; total: number }
  equity: { lines: Line[]; total: number }
  totalAssets: number
  totalLiabilitiesAndEquity: number
  balanceDifference: number
  inventoryWarnings?: string[]
}

type ManualItem = {
  groupId: string
  category: Category
  name: string
  amount: number
  effectiveDate: string
  notes: string
}

type FormState = {
  groupId: string | null
  category: Category
  name: string
  amount: string
  effectiveDate: string
  notes: string
}

function todayInput() {
  return formatKigaliDateInput(new Date())
}

type FetchResult =
  | { sheet: Sheet; manualItems: ManualItem[] }
  | { error: string }

async function fetchBalanceSheet(date: string): Promise<FetchResult> {
  try {
    const params = new URLSearchParams({ asOf: date })
    const response = await fetch(
      `/api/financial-statements/balance-sheet?${params.toString()}`
    )
    const body = await response.json().catch(() => null)

    if (!response.ok || !body?.success) {
      return { error: body?.error ?? "Failed to load the balance sheet." }
    }

    return {
      sheet: body.data.sheet,
      manualItems: body.data.manualItems ?? [],
    }
  } catch {
    return { error: "Failed to load the balance sheet." }
  }
}

function emptyForm(asOf: string): FormState {
  return {
    groupId: null,
    category: "current_asset",
    name: "",
    amount: "",
    effectiveDate: asOf || todayInput(),
    notes: "",
  }
}

function LineRows({
  lines,
  onEdit,
  onDelete,
}: {
  lines: Line[]
  onEdit: (line: Line) => void
  onDelete: (groupId: string) => void
}) {
  if (lines.length === 0) {
    return <p className="py-2 text-sm text-muted-foreground">None recorded.</p>
  }

  return (
    <dl className="divide-y divide-border">
      {lines.map((line) => (
        <div
          key={line.id ?? line.label}
          className="flex items-start justify-between gap-4 py-2.5"
        >
          <div className="min-w-0">
            <dt className="text-sm text-foreground">{line.label}</dt>
            {line.note ? (
              <p className="mt-0.5 text-xs text-muted-foreground">{line.note}</p>
            ) : null}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <dd className="text-sm tabular-nums text-foreground">
              {formatCurrency(line.amount)}
            </dd>
            {line.source === "manual" && line.id ? (
              <div className="flex gap-1">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => onEdit(line)}
                  aria-label={`Edit ${line.label}`}
                >
                  <Pencil className="size-3.5" />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => onDelete(line.id as string)}
                  aria-label={`Remove ${line.label}`}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            ) : null}
          </div>
        </div>
      ))}
    </dl>
  )
}

function Section({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <div className="space-y-1">
      <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {title}
      </h4>
      {children}
    </div>
  )
}

export function BalanceSheetView() {
  const [asOf, setAsOf] = useState(() => todayInput())
  const [sheet, setSheet] = useState<Sheet | null>(null)
  const [items, setItems] = useState<ManualItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [formOpen, setFormOpen] = useState(false)
  const [form, setForm] = useState<FormState>(() => emptyForm(todayInput()))
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  const apply = useCallback((result: FetchResult) => {
    if ("error" in result) {
      setError(result.error)
      setSheet(null)
    } else {
      setError(null)
      setSheet(result.sheet)
      setItems(result.manualItems)
    }
    setLoading(false)
  }, [])

  const load = useCallback(
    async (date: string) => {
      setLoading(true)
      setError(null)
      apply(await fetchBalanceSheet(date))
    },
    [apply]
  )

  // The effect only starts the request; every state update happens after the
  // await, so no render is triggered synchronously from the effect body.
  useEffect(() => {
    let cancelled = false
    void fetchBalanceSheet(todayInput()).then((result) => {
      if (!cancelled) apply(result)
    })
    return () => {
      cancelled = true
    }
  }, [apply])

  const openCreate = () => {
    setForm(emptyForm(asOf))
    setFormError(null)
    setFormOpen(true)
  }

  const openEdit = (line: Line) => {
    const item = items.find((entry) => entry.groupId === line.id)
    if (!item) return
    setForm({
      groupId: item.groupId,
      category: item.category,
      name: item.name,
      amount: String(item.amount),
      // Default a revision to the viewed date so it applies from here forward.
      effectiveDate: asOf || todayInput(),
      notes: item.notes,
    })
    setFormError(null)
    setFormOpen(true)
  }

  const submitForm = async () => {
    const amount = Number(form.amount)
    if (!form.name.trim() || form.name.trim().length < 2) {
      setFormError("Enter a name of at least 2 characters.")
      return
    }
    if (!Number.isFinite(amount) || amount < 0) {
      setFormError("Enter an amount of 0 or more.")
      return
    }

    setSaving(true)
    setFormError(null)

    try {
      const response = await fetch(
        form.groupId
          ? `/api/financial-statements/balance-sheet/items/${form.groupId}`
          : "/api/financial-statements/balance-sheet/items",
        {
          method: form.groupId ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            category: form.category,
            name: form.name.trim(),
            amount,
            effectiveDate: form.effectiveDate,
            notes: form.notes.trim() || undefined,
          }),
        }
      )
      const body = await response.json().catch(() => null)

      if (!response.ok || !body?.success) {
        setFormError(body?.error ?? "Failed to save the item.")
        return
      }

      setFormOpen(false)
      await load(asOf)
    } catch {
      setFormError("Failed to save the item.")
    } finally {
      setSaving(false)
    }
  }

  const confirmDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    setDeleteError(null)

    try {
      const response = await fetch(
        `/api/financial-statements/balance-sheet/items/${deleteTarget}`,
        {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ effectiveDate: asOf }),
        }
      )
      const body = await response.json().catch(() => null)

      if (!response.ok || !body?.success) {
        setDeleteError(body?.error ?? "Failed to remove the item.")
        return
      }

      setDeleteTarget(null)
      await load(asOf)
    } catch {
      setDeleteError("Failed to remove the item.")
    } finally {
      setDeleting(false)
    }
  }

  const balanced = sheet ? Math.round(sheet.balanceDifference) === 0 : false

  return (
    <div className="space-y-4">
      <div className="grid gap-3 rounded-2xl border border-border/80 bg-card p-4 shadow-sm md:grid-cols-[1fr_auto_auto]">
        <label className="space-y-1 text-sm font-medium text-foreground">
          As of
          <Input
            type="date"
            value={asOf}
            onChange={(event) => setAsOf(event.target.value)}
          />
        </label>
        <div className="flex items-end">
          <Button
            type="button"
            className="w-full md:w-auto"
            onClick={() => void load(asOf)}
            disabled={loading}
          >
            {loading ? "Loading..." : "Apply"}
          </Button>
        </div>
        <div className="flex items-end">
          <Button
            type="button"
            variant="outline"
            className="w-full md:w-auto"
            onClick={openCreate}
          >
            <Plus className="size-4" />
            Add item
          </Button>
        </div>
      </div>

      {error ? (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      {loading && !sheet ? (
        <p className="py-6 text-sm text-muted-foreground">
          Loading the balance sheet...
        </p>
      ) : !sheet ? null : (
        <>
          <div
            className={cn(
              "rounded-2xl border p-4 text-sm shadow-sm",
              balanced
                ? "border-border/80 bg-card text-muted-foreground"
                : "border-warning/30 bg-warning/10 text-warning"
            )}
          >
            {balanced ? (
              <>Assets equal liabilities plus equity as of {sheet.asOf}.</>
            ) : (
              <>
                Out of balance by {formatCurrency(sheet.balanceDifference)}. Owner
                capital and drawings are not tracked automatically — record them as
                manual equity items to close the gap.
              </>
            )}
          </div>

          {sheet.inventoryWarnings && sheet.inventoryWarnings.length > 0 ? (
            <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
              Inconsistent stock history for: {sheet.inventoryWarnings.join(", ")}.
              These are excluded from the inventory valuation.
            </div>
          ) : null}

          <div className="grid gap-4 lg:grid-cols-2">
            <section className="space-y-4 rounded-2xl border border-border/80 bg-card p-4 shadow-sm">
              <h3 className="text-lg font-semibold">Assets</h3>
              <Section title="Current assets">
                <LineRows
                  lines={sheet.assets.current}
                  onEdit={openEdit}
                  onDelete={setDeleteTarget}
                />
              </Section>
              <Section title="Fixed assets">
                <LineRows
                  lines={sheet.assets.fixed}
                  onEdit={openEdit}
                  onDelete={setDeleteTarget}
                />
              </Section>
              <div className="flex items-baseline justify-between border-t-2 border-border pt-3">
                <span className="font-semibold">Total Assets</span>
                <span className="font-semibold tabular-nums">
                  {formatCurrency(sheet.totalAssets)}
                </span>
              </div>
            </section>

            <section className="space-y-4 rounded-2xl border border-border/80 bg-card p-4 shadow-sm">
              <h3 className="text-lg font-semibold">Liabilities &amp; Equity</h3>
              <Section title="Current liabilities">
                <LineRows
                  lines={sheet.liabilities.current}
                  onEdit={openEdit}
                  onDelete={setDeleteTarget}
                />
              </Section>
              <Section title="Long-term liabilities">
                <LineRows
                  lines={sheet.liabilities.longTerm}
                  onEdit={openEdit}
                  onDelete={setDeleteTarget}
                />
              </Section>
              <Section title="Equity">
                <LineRows
                  lines={sheet.equity.lines}
                  onEdit={openEdit}
                  onDelete={setDeleteTarget}
                />
              </Section>
              <div className="flex items-baseline justify-between border-t-2 border-border pt-3">
                <span className="font-semibold">
                  Total Liabilities &amp; Equity
                </span>
                <span className="font-semibold tabular-nums">
                  {formatCurrency(sheet.totalLiabilitiesAndEquity)}
                </span>
              </div>
            </section>
          </div>
        </>
      )}

      <Dialog
        open={formOpen}
        onOpenChange={(open) => {
          if (!open && !saving) setFormOpen(false)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {form.groupId ? "Revise item" : "Add balance sheet item"}
            </DialogTitle>
            <DialogDescription>
              Saving records a dated revision. Sheets before the effective date keep
              the previous figures.
            </DialogDescription>
          </DialogHeader>

          {formError ? (
            <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
              {formError}
            </div>
          ) : null}

          <div className="space-y-3">
            <label className="block space-y-1 text-sm font-medium text-foreground">
              Category
              <Select
                value={form.category}
                onValueChange={(value) =>
                  setForm((current) => ({
                    ...current,
                    category: value as Category,
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(CATEGORY_LABELS) as Category[]).map((key) => (
                    <SelectItem key={key} value={key}>
                      {CATEGORY_LABELS[key]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>

            <label className="block space-y-1 text-sm font-medium text-foreground">
              Name
              <Input
                value={form.name}
                onChange={(event) =>
                  setForm((current) => ({ ...current, name: event.target.value }))
                }
                placeholder="Bank loan, owner capital, equipment..."
              />
            </label>

            <label className="block space-y-1 text-sm font-medium text-foreground">
              Amount
              <Input
                type="number"
                min="0"
                step="0.01"
                value={form.amount}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    amount: event.target.value,
                  }))
                }
              />
            </label>

            <label className="block space-y-1 text-sm font-medium text-foreground">
              Effective from
              <Input
                type="date"
                value={form.effectiveDate}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    effectiveDate: event.target.value,
                  }))
                }
              />
            </label>

            <label className="block space-y-1 text-sm font-medium text-foreground">
              Notes
              <Input
                value={form.notes}
                onChange={(event) =>
                  setForm((current) => ({ ...current, notes: event.target.value }))
                }
                placeholder="Optional"
              />
            </label>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setFormOpen(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button type="button" onClick={submitForm} disabled={saving}>
              {saving ? "Saving..." : "Save item"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open && !deleting) {
            setDeleteTarget(null)
            setDeleteError(null)
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove balance sheet item?</DialogTitle>
            <DialogDescription>
              This records a dated removal. Sheets before the current as-of date
              still include the item.
            </DialogDescription>
          </DialogHeader>

          {deleteError ? (
            <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
              {deleteError}
            </div>
          ) : null}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setDeleteTarget(null)}
              disabled={deleting}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={confirmDelete}
              disabled={deleting}
            >
              {deleting ? "Removing..." : "Remove Item"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
