"use client"

// Manages branch expense entry, filtering, editing, and deletion interactions.
import { useMemo, useState } from "react"
import { Pencil, Plus, Search, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { StatsCard } from "@/components/dashboard/stats-card"
import { formatCurrency } from "@/lib/utils/format"
import { formatInKigali } from "@/lib/utils/time"

const PAYMENT_METHODS: Array<{ value: "cash" | "mobile-money" | "bank"; label: string }> = [
  { value: "cash", label: "Cash" },
  { value: "bank", label: "Bank" },
  { value: "mobile-money", label: "Mobile Money" },
]

type ExpenseClient = {
  _id: string
  description: string
  amount: number
  category: string
  paymentMethod: "cash" | "mobile-money" | "bank"
  date?: string
  notes?: string
  createdByName?: string
  dateLabel?: string
}

type FormState = {
  description: string
  amount: string
  category: string
  paymentMethod: "cash" | "mobile-money" | "bank"
  date: string
  notes: string
}

const emptyForm: FormState = {
  description: "",
  amount: "",
  category: "",
  paymentMethod: "cash",
  date: "",
  notes: "",
}

const RECENT_DAYS = 30

export function ExpensesManager({
  initialExpenses,
}: {
  initialExpenses: ExpenseClient[]
}) {
  const [expenses, setExpenses] = useState(initialExpenses)
  const [search, setSearch] = useState("")
  const [dialogOpen, setDialogOpen] = useState(false)
  const [activeExpenseId, setActiveExpenseId] = useState<string | null>(null)
  const [formState, setFormState] = useState<FormState>(emptyForm)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const filteredExpenses = useMemo(() => {
    const query = search.trim().toLowerCase()
    if (!query) return expenses

    return expenses.filter((expense) => {
      return (
        expense.description.toLowerCase().includes(query) ||
        expense.category.toLowerCase().includes(query)
      )
    })
  }, [expenses, search])

  const totalExpenses = useMemo(() => {
    return filteredExpenses.reduce((sum, expense) => sum + expense.amount, 0)
  }, [filteredExpenses])

  const recentCount = useMemo(() => {
    const cutoff = Date.now() - RECENT_DAYS * 24 * 60 * 60 * 1000
    return filteredExpenses.filter((expense) => {
      if (!expense.date) return false
      return new Date(expense.date).getTime() >= cutoff
    }).length
  }, [filteredExpenses])

  const resetForm = () => {
    setFormState(emptyForm)
    setActiveExpenseId(null)
    setError(null)
  }

  const openCreate = () => {
    resetForm()
    setDialogOpen(true)
  }

  const openEdit = (expense: ExpenseClient) => {
    setFormState({
      description: expense.description,
      amount: String(expense.amount),
      category: expense.category,
      paymentMethod: expense.paymentMethod,
      date: expense.date ? expense.date.slice(0, 10) : "",
      notes: expense.notes ?? "",
    })
    setActiveExpenseId(expense._id)
    setError(null)
    setDialogOpen(true)
  }

  const submitForm = async () => {
    const description = formState.description.trim()
    const category = formState.category.trim()
    const amount = Number(formState.amount)

    if (!description) {
      setError("Description is required.")
      return
    }

    if (!Number.isFinite(amount) || amount < 0) {
      setError("Amount must be 0 or greater.")
      return
    }

    if (!formState.date) {
      setError("Select a date for the expense.")
      return
    }

    setSubmitting(true)
    setError(null)

    const payload = {
      description,
      amount,
      category,
      paymentMethod: formState.paymentMethod,
      date: formState.date,
      notes: formState.notes.trim(),
    }

    try {
      const response = await fetch(
        activeExpenseId ? `/api/expenses/${activeExpenseId}` : "/api/expenses",
        {
          method: activeExpenseId ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      )

      const body = await response.json()
      if (!response.ok || !body?.success) {
        setError(body?.error ?? "Failed to save expense.")
        return
      }

      const saved = body.data as ExpenseClient
      const dateLabel = saved.date
        ? formatInKigali(saved.date, {
            year: "numeric",
            month: "short",
            day: "2-digit",
          })
        : "-"

      const normalized = {
        ...saved,
        _id: saved._id.toString(),
        dateLabel,
      }

      setExpenses((current) =>
        activeExpenseId
          ? current.map((expense) =>
              expense._id === activeExpenseId ? normalized : expense
            )
          : [normalized, ...current]
      )

      setDialogOpen(false)
      resetForm()
    } catch {
      setError("Failed to save expense.")
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (expenseId: string) => {
    if (!confirm("Delete this expense?") ) {
      return
    }

    setSubmitting(true)
    setError(null)

    try {
      const response = await fetch(`/api/expenses/${expenseId}`, {
        method: "DELETE",
      })
      const body = await response.json().catch(() => null)

      if (!response.ok || !body?.success) {
        setError(body?.error ?? "Failed to delete expense.")
        return
      }

      setExpenses((current) =>
        current.filter((expense) => expense._id !== expenseId)
      )
    } catch {
      setError("Failed to delete expense.")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
            Operations
          </p>
          <h2 className="text-2xl font-semibold">Expenses</h2>
          <p className="text-sm text-muted-foreground">
            Track operational expenses by category and payment method.
          </p>
        </div>
        <div className="flex w-full flex-wrap gap-2 sm:w-auto">
          <div className="relative w-full sm:w-56">
            <Search className="pointer-events-none absolute left-3 top-2.5 size-4 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Search expenses"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={openCreate}>
                <Plus className="size-4" />
                Add Expense
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>
                  {activeExpenseId ? "Edit expense" : "Add expense"}
                </DialogTitle>
              </DialogHeader>
              <div className="grid gap-3">
                <label className="grid gap-1 text-sm">
                  Description
                  <Input
                    value={formState.description}
                    onChange={(event) =>
                      setFormState((prev) => ({
                        ...prev,
                        description: event.target.value,
                      }))
                    }
                  />
                </label>
                <label className="grid gap-1 text-sm">
                  Category (optional)
                  <Input
                    value={formState.category}
                    onChange={(event) =>
                      setFormState((prev) => ({
                        ...prev,
                        category: event.target.value,
                      }))
                    }
                  />
                </label>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="grid gap-1 text-sm">
                    Amount
                    <Input
                      type="number"
                      min={0}
                      step="0.01"
                      value={formState.amount}
                      onChange={(event) =>
                        setFormState((prev) => ({
                          ...prev,
                          amount: event.target.value,
                        }))
                      }
                    />
                  </label>
                  <label className="grid gap-1 text-sm">
                    Date
                    <Input
                      type="date"
                      value={formState.date}
                      onChange={(event) =>
                        setFormState((prev) => ({
                          ...prev,
                          date: event.target.value,
                        }))
                      }
                    />
                  </label>
                </div>
                <label className="grid gap-1 text-sm">
                  Payment Method
                  <Select
                    value={formState.paymentMethod}
                    onValueChange={(value) =>
                      setFormState((prev) => ({
                        ...prev,
                        paymentMethod: value as FormState["paymentMethod"],
                      }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select method" />
                    </SelectTrigger>
                    <SelectContent>
                      {PAYMENT_METHODS.map((method) => (
                        <SelectItem key={method.value} value={method.value}>
                          {method.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </label>
                <label className="grid gap-1 text-sm">
                  Notes (optional)
                  <textarea
                    value={formState.notes}
                    onChange={(event) =>
                      setFormState((prev) => ({
                        ...prev,
                        notes: event.target.value,
                      }))
                    }
                    className="min-h-20 rounded-md border border-border px-3 py-2"
                  />
                </label>
                {error ? <p className="text-sm text-destructive">{error}</p> : null}
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setDialogOpen(false)}
                  disabled={submitting}
                >
                  Cancel
                </Button>
                <Button type="button" onClick={submitForm} disabled={submitting}>
                  {submitting ? "Saving..." : "Save"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <StatsCard label="Total Expenses" value={formatCurrency(totalExpenses)} />
        <StatsCard label={`Last ${RECENT_DAYS} Days`} value={recentCount} />
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Date</TableHead>
            <TableHead>Description</TableHead>
            <TableHead>Category</TableHead>
            <TableHead>Payment Method</TableHead>
            <TableHead>Amount</TableHead>
            <TableHead>Recorded By</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filteredExpenses.length === 0 ? (
            <TableRow>
              <TableCell colSpan={7} className="text-muted-foreground">
                No expenses recorded yet.
              </TableCell>
            </TableRow>
          ) : (
            filteredExpenses.map((expense) => (
              <TableRow key={expense._id}>
                <TableCell>
                  {expense.dateLabel ??
                    (expense.date
                      ? formatInKigali(expense.date, {
                          year: "numeric",
                          month: "short",
                          day: "2-digit",
                        })
                      : "-")}
                </TableCell>
                <TableCell className="whitespace-normal wrap-break-word">
                  {expense.description}
                </TableCell>
                <TableCell>{expense.category}</TableCell>
                <TableCell>
                  {PAYMENT_METHODS.find(
                    (method) => method.value === expense.paymentMethod
                  )?.label ?? expense.paymentMethod}
                </TableCell>
                <TableCell>{formatCurrency(expense.amount)}</TableCell>
                <TableCell>{expense.createdByName ?? "-"}</TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openEdit(expense)}
                    >
                      <Pencil className="size-4" />
                      Edit
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDelete(expense._id)}
                      disabled={submitting}
                    >
                      <Trash2 className="size-4" />
                      Delete
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  )
}
