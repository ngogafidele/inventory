"use client"

// Manages receivable searches, settlements, statements, and admin corrections.
import { Fragment, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { CreditCard, Download, RotateCcw, Search, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { PasswordConfirmDialog } from "@/components/auth/password-confirm-dialog"
import { StatsCard } from "@/components/dashboard/stats-card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { formatCurrency } from "@/lib/utils/format"
import { formatInKigali, formatKigaliDateInput } from "@/lib/utils/time"

type OutstandingItem = {
  name: string
  unit?: string
  quantity: number
}

type OutstandingDetails = {
  customerName: string
  customerPhone?: string
  paymentDate?: string
}

type OutstandingSale = {
  _id: string
  createdAtLabel?: string
  createdAt?: string
  outstanding?: OutstandingDetails
  items: OutstandingItem[]
  createdByName?: string
  totalAmount: number
  paymentStatus?: "paid" | "unpaid"
  amountPaid?: number
  remainingBalance?: number
  payments?: Array<{
    amount: number
    paymentMethod: "cash" | "bank" | "mobile"
    paidAt?: string
    notes?: string
  }>
}

type DeletedOutstandingSale = OutstandingSale & {
  deletedByName?: string
  deletedAtLabel?: string
}

function summarizeItems(items: OutstandingItem[]) {
  if (!items.length) return "-"
  return items
    .map((item) => {
      const unit = item.unit ?? "pcs"
      return `${item.name} (${item.quantity} ${unit})`
    })
    .join(", ")
}

function normalizeSearchText(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "")
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100
}

function getAmountPaid(sale: OutstandingSale) {
  if (typeof sale.amountPaid === "number") return roundMoney(sale.amountPaid)
  return roundMoney(
    (sale.payments ?? []).reduce((sum, payment) => sum + payment.amount, 0)
  )
}

function getRemainingBalance(sale: OutstandingSale) {
  if (typeof sale.remainingBalance === "number") {
    return roundMoney(sale.remainingBalance)
  }
  return Math.max(0, roundMoney(sale.totalAmount - getAmountPaid(sale)))
}

function getPaymentMethodLabel(value: "cash" | "bank" | "mobile") {
  if (value === "mobile") return "Mobile Money"
  return value.charAt(0).toUpperCase() + value.slice(1)
}

// The header badge fetches independently, so mutations trigger its refresh.
function refreshLoanNotifications() {
  window.dispatchEvent(new Event("loan-notifications:refresh"))
}

export function OutstandingManager({
  initialSales,
  initialDeletedSales,
  isAdmin,
}: {
  initialSales: OutstandingSale[]
  initialDeletedSales: DeletedOutstandingSale[]
  isAdmin: boolean
}) {
  const router = useRouter()
  const [sales, setSales] = useState(initialSales)
  const [deletedSales, setDeletedSales] = useState(initialDeletedSales)
  const [restoringId, setRestoringId] = useState<string | null>(null)
  const [restoreError, setRestoreError] = useState<string | null>(null)
  const [restoreTarget, setRestoreTarget] =
    useState<DeletedOutstandingSale | null>(null)
  const [search, setSearch] = useState("")
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<OutstandingSale | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [paymentTarget, setPaymentTarget] = useState<OutstandingSale | null>(
    null
  )
  const [paymentAmount, setPaymentAmount] = useState("")
  const [paymentNotes, setPaymentNotes] = useState("")
  const [paymentMethod, setPaymentMethod] = useState<
    "cash" | "bank" | "mobile"
  >("cash")

  const matchesFilters = (sale: OutstandingSale, query: string, normalizedQuery: string) => {
    const saleDate = sale.createdAt ? formatKigaliDateInput(sale.createdAt) : ""
    if (dateFrom && (!saleDate || saleDate < dateFrom)) return false
    if (dateTo && (!saleDate || saleDate > dateTo)) return false

    if (!query) return true

    const name = sale.outstanding?.customerName?.toLowerCase() ?? ""
    const phone = sale.outstanding?.customerPhone?.toLowerCase() ?? ""
    const normalizedName = normalizeSearchText(name)
    const normalizedPhone = normalizeSearchText(phone)
    return (
      name.includes(query) ||
      phone.includes(query) ||
      normalizedName.includes(normalizedQuery) ||
      normalizedPhone.includes(normalizedQuery)
    )
  }

  const filteredSales = useMemo(() => {
    const query = search.trim().toLowerCase()
    const normalizedQuery = normalizeSearchText(search.trim())
    return sales.filter((sale) => matchesFilters(sale, query, normalizedQuery))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sales, search, dateFrom, dateTo])

  const filteredDeletedSales = useMemo(() => {
    const query = search.trim().toLowerCase()
    const normalizedQuery = normalizeSearchText(search.trim())
    return deletedSales.filter((sale) =>
      matchesFilters(sale, query, normalizedQuery)
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deletedSales, search, dateFrom, dateTo])

  const totalOutstanding = useMemo(() => {
    return filteredSales.reduce(
      (sum, sale) => sum + getRemainingBalance(sale),
      0
    )
  }, [filteredSales])

  const openPaymentDialog = (sale: OutstandingSale) => {
    setError(null)
    setPaymentTarget(sale)
    setPaymentAmount(String(getRemainingBalance(sale)))
    setPaymentNotes("")
    setPaymentMethod("cash")
  }

  const downloadPdf = async (sale: OutstandingSale) => {
    setError(null)

    const customerName = sale.outstanding?.customerName?.trim()
    if (!customerName) {
      setError("Customer name is missing for this sale.")
      return
    }

    const params = new URLSearchParams({ customerName })
    const phone = sale.outstanding?.customerPhone?.trim()
    if (phone) params.set("customerPhone", phone)

    try {
      const response = await fetch(`/api/outstanding/pdf?${params.toString()}`)
      if (!response.ok) {
        const body = await response.json().catch(() => null)
        setError(body?.error ?? "Failed to download statement PDF.")
        return
      }

      const disposition = response.headers.get("Content-Disposition")
      const match = disposition?.match(/filename="([^"]+)"/)
      const filename =
        match?.[1] ?? `${customerName.replace(/\s+/g, "-").toLowerCase()}.pdf`
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url
      link.download = filename
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(url)
    } catch {
      setError("Failed to download statement PDF.")
    }
  }

  const recordPayment = async () => {
    if (!paymentTarget) return

    const amount = Number(paymentAmount)
    if (!Number.isFinite(amount) || amount <= 0) {
      setError("Enter a payment amount greater than zero.")
      return
    }

    const remainingBalance = getRemainingBalance(paymentTarget)
    if (amount > remainingBalance) {
      setError("Payment amount cannot exceed the remaining loan balance.")
      return
    }

    setError(null)
    setUpdatingId(paymentTarget._id)

    try {
      const response = await fetch(`/api/sales/${paymentTarget._id}/payments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount,
          paymentMethod,
          notes: paymentNotes,
        }),
      })
      const body = await response.json().catch(() => null)

      if (!response.ok || !body?.success) {
        setError(body?.error ?? "Failed to record payment.")
        return
      }

      const updatedSale = body.data as OutstandingSale
      setSales((current) => {
        if (updatedSale.paymentStatus === "paid") {
          return current.filter((sale) => sale._id !== paymentTarget._id)
        }
        return current.map((sale) =>
          sale._id === paymentTarget._id
            ? {
                ...sale,
                amountPaid: updatedSale.amountPaid,
                remainingBalance: updatedSale.remainingBalance,
                payments: updatedSale.payments,
              }
            : sale
        )
      })
      setPaymentTarget(null)
      refreshLoanNotifications()
      router.refresh()
    } catch {
      setError("Failed to record payment.")
    } finally {
      setUpdatingId(null)
    }
  }

  const deleteLoan = async (password: string) => {
    if (!deleteTarget) return

    setError(null)
    setDeleteError(null)
    setDeletingId(deleteTarget._id)

    try {
      const response = await fetch(`/api/sales/${deleteTarget._id}?loan=true`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      })
      const body = await response.json().catch(() => null)

      if (!response.ok || !body?.success) {
        // Kept inside the dialog so a mistyped password can be corrected
        // without losing which loan was being deleted.
        setDeleteError(body?.error ?? "Failed to delete loan.")
        return
      }

      setSales((current) =>
        current.filter((sale) => sale._id !== deleteTarget._id)
      )
      setDeleteTarget(null)
      refreshLoanNotifications()
      router.refresh()
    } catch {
      setDeleteError("Failed to delete loan.")
    } finally {
      setDeletingId(null)
    }
  }

  const restoreLoan = async (
    sale: DeletedOutstandingSale,
    password: string
  ) => {
    setRestoreError(null)
    setRestoringId(sale._id)

    try {
      const response = await fetch(`/api/sales/${sale._id}/restore`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      })
      const body = await response.json().catch(() => null)

      if (!response.ok || !body?.success) {
        setRestoreError(body?.error ?? "Failed to restore loan.")
        return
      }

      const { deletedByName: _deletedByName, deletedAtLabel: _deletedAtLabel, ...restored } =
        sale
      setDeletedSales((current) =>
        current.filter((item) => item._id !== sale._id)
      )
      setSales((current) => [restored, ...current])
      setRestoreTarget(null)
      refreshLoanNotifications()
      router.refresh()
    } catch {
      setRestoreError("Failed to restore loan.")
    } finally {
      setRestoringId(null)
    }
  }

  // Only closes on success, so a mistyped password can be corrected without
  // losing which loan was being restored.
  const handleRestore = async (password: string) => {
    if (!restoreTarget) return
    await restoreLoan(restoreTarget, password)
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
            Receivables
          </p>
          <h2 className="text-2xl font-semibold">Loans</h2>
          <p className="text-sm text-muted-foreground">
            Track loans and follow up on expected payments.
          </p>
        </div>
        <div className="relative w-full sm:max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-2.5 size-4 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search by customer name or number"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <label className="grid gap-1 text-sm">
          From
          <Input
            type="date"
            value={dateFrom}
            max={dateTo || undefined}
            onChange={(event) => setDateFrom(event.target.value)}
            aria-label="Filter loans from date"
          />
        </label>
        <label className="grid gap-1 text-sm">
          To
          <Input
            type="date"
            value={dateTo}
            min={dateFrom || undefined}
            onChange={(event) => setDateTo(event.target.value)}
            aria-label="Filter loans to date"
          />
        </label>
        {dateFrom || dateTo ? (
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setDateFrom("")
              setDateTo("")
            }}
          >
            Clear dates
          </Button>
        ) : null}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <StatsCard label="Loan Sales" value={filteredSales.length} />
        <StatsCard
          label="Remaining Loans"
          value={formatCurrency(totalOutstanding)}
        />
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Sale Date</TableHead>
            <TableHead>Customer</TableHead>
            <TableHead>Phone</TableHead>
            <TableHead>Payment Date</TableHead>
            <TableHead>Items</TableHead>
            <TableHead>Recorded By</TableHead>
            <TableHead>Total Loan</TableHead>
            <TableHead>Paid</TableHead>
            <TableHead>Remaining</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filteredSales.length === 0 ? (
            <TableRow>
              <TableCell colSpan={10} className="text-muted-foreground">
                No loans found.
              </TableCell>
            </TableRow>
          ) : (
            filteredSales.map((sale, saleIndex) => {
              const paymentDate = sale.outstanding?.paymentDate
              const paymentDateLabel = paymentDate
                ? formatInKigali(paymentDate, {
                    year: "numeric",
                    month: "short",
                    day: "2-digit",
                  })
                : "-"
              const amountPaid = getAmountPaid(sale)
              const remainingBalance = getRemainingBalance(sale)
              const payments = sale.payments ?? []

              return (
                <Fragment key={sale._id}>
                  <TableRow
                    className={
                      saleIndex % 2 === 1
                        ? "bg-muted/60 hover:bg-muted/70"
                        : undefined
                    }
                  >
                    <TableCell>{sale.createdAtLabel ?? "-"}</TableCell>
                    <TableCell className="whitespace-normal">
                      {sale.outstanding?.customerName ?? "-"}
                    </TableCell>
                    <TableCell>
                      {sale.outstanding?.customerPhone ?? "-"}
                    </TableCell>
                    <TableCell>{paymentDateLabel}</TableCell>
                    <TableCell className="whitespace-normal">
                      {summarizeItems(sale.items)}
                    </TableCell>
                    <TableCell>{sale.createdByName ?? "-"}</TableCell>
                    <TableCell>{formatCurrency(sale.totalAmount)}</TableCell>
                    <TableCell>{formatCurrency(amountPaid)}</TableCell>
                    <TableCell>{formatCurrency(remainingBalance)}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          type="button"
                          onClick={() => downloadPdf(sale)}
                        >
                          <Download className="size-4" />
                          PDF
                        </Button>
                        <Button
                          size="sm"
                          type="button"
                          onClick={() => openPaymentDialog(sale)}
                          disabled={updatingId === sale._id}
                        >
                          <CreditCard className="size-4" />
                          {updatingId === sale._id ? "Saving..." : "Payment"}
                        </Button>
                        {isAdmin ? (
                          <Button
                            variant="destructive"
                            size="sm"
                            type="button"
                            onClick={() => setDeleteTarget(sale)}
                            disabled={deletingId === sale._id}
                          >
                            <Trash2 className="size-4" />
                            Delete
                          </Button>
                        ) : null}
                      </div>
                    </TableCell>
                  </TableRow>
                  {payments.length > 0 ? (
                    <TableRow
                      className={
                        saleIndex % 2 === 1
                          ? "bg-muted/60 hover:bg-muted/70"
                          : undefined
                      }
                    >
                      <TableCell
                        colSpan={10}
                        className="text-xs text-muted-foreground"
                      >
                        <span className="font-medium text-foreground">
                          Payments:
                        </span>{" "}
                        {payments
                          .map((payment) => {
                            const paidAt = payment.paidAt
                              ? formatInKigali(payment.paidAt, {
                                  year: "numeric",
                                  month: "short",
                                  day: "2-digit",
                                })
                              : "-"
                            const notes = payment.notes?.trim()
                            return `${formatCurrency(payment.amount)} via ${getPaymentMethodLabel(
                              payment.paymentMethod
                            )} on ${paidAt}${notes ? ` (${notes})` : ""}`
                          })
                          .join("; ")}
                      </TableCell>
                    </TableRow>
                  ) : null}
                </Fragment>
              )
            })
          )}
        </TableBody>
      </Table>

      {isAdmin ? (
        <section className="space-y-3 rounded-2xl border border-border bg-card p-4 sm:p-5">
          <div>
            <h3 className="text-lg font-semibold">Deleted Loans</h3>
            <p className="text-sm text-muted-foreground">
              Retained for records and excluded from all business numbers.
              Restoring returns a loan to the active list and re-applies its
              stock movement.
            </p>
          </div>

          {restoreError ? (
            <p className="text-sm text-destructive">{restoreError}</p>
          ) : null}

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Sale Date</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Items</TableHead>
                <TableHead>Total Loan</TableHead>
                <TableHead>Remaining</TableHead>
                <TableHead>Deleted By</TableHead>
                <TableHead>Deleted On</TableHead>
                <TableHead>Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredDeletedSales.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-muted-foreground">
                    {dateFrom || dateTo || search.trim()
                      ? "No matching deleted loans."
                      : "No deleted loans."}
                  </TableCell>
                </TableRow>
              ) : (
                filteredDeletedSales.map((sale) => (
                  <TableRow key={sale._id}>
                    <TableCell>{sale.createdAtLabel ?? "-"}</TableCell>
                    <TableCell className="whitespace-normal">
                      {sale.outstanding?.customerName ?? "-"}
                    </TableCell>
                    <TableCell>
                      {sale.outstanding?.customerPhone ?? "-"}
                    </TableCell>
                    <TableCell className="whitespace-normal">
                      {summarizeItems(sale.items)}
                    </TableCell>
                    <TableCell>{formatCurrency(sale.totalAmount)}</TableCell>
                    <TableCell>
                      {formatCurrency(getRemainingBalance(sale))}
                    </TableCell>
                    <TableCell>{sale.deletedByName ?? "-"}</TableCell>
                    <TableCell>{sale.deletedAtLabel ?? "-"}</TableCell>
                    <TableCell>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setRestoreTarget(sale)}
                        disabled={restoringId === sale._id}
                      >
                        <RotateCcw className="size-4" />
                        {restoringId === sale._id ? "Restoring..." : "Restore"}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </section>
      ) : null}

      <Dialog
        open={paymentTarget !== null}
        onOpenChange={(open) => {
          if (!open && !updatingId) {
            setPaymentTarget(null)
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record loan payment</DialogTitle>
            <DialogDescription>
              Record an installment and update the remaining loan balance.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="grid gap-1 text-sm">
              <span className="text-muted-foreground">Customer</span>
              <span className="font-medium">
                {paymentTarget?.outstanding?.customerName ?? "-"}
              </span>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div>
                <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                  Total
                </p>
                <p className="font-semibold">
                  {formatCurrency(paymentTarget?.totalAmount ?? 0)}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                  Paid
                </p>
                <p className="font-semibold">
                  {formatCurrency(
                    paymentTarget ? getAmountPaid(paymentTarget) : 0
                  )}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                  Remaining
                </p>
                <p className="font-semibold">
                  {formatCurrency(
                    paymentTarget ? getRemainingBalance(paymentTarget) : 0
                  )}
                </p>
              </div>
            </div>
            <label className="grid gap-1 text-sm">
              Amount paid
              <Input
                type="number"
                min="0"
                step="0.01"
                value={paymentAmount}
                onChange={(event) => setPaymentAmount(event.target.value)}
              />
            </label>
            <label className="grid gap-1 text-sm">
              Payment method
              <Select
                value={paymentMethod}
                onValueChange={(value) =>
                  setPaymentMethod(value as "cash" | "bank" | "mobile")
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select method" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="bank">Bank</SelectItem>
                  <SelectItem value="mobile">Mobile Money</SelectItem>
                </SelectContent>
              </Select>
            </label>
            <label className="grid gap-1 text-sm">
              Notes
              <Input
                value={paymentNotes}
                onChange={(event) => setPaymentNotes(event.target.value)}
                placeholder="Optional note"
              />
            </label>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setPaymentTarget(null)}
              disabled={updatingId !== null}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={recordPayment}
              disabled={updatingId !== null}
            >
              {updatingId ? "Recording..." : "Record Payment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {isAdmin ? (
        <PasswordConfirmDialog
          open={deleteTarget !== null}
          onOpenChange={(open) => {
            if (!open && !deletingId) {
              setDeleteTarget(null)
              setDeleteError(null)
            }
          }}
          title="Delete loan?"
          description="This removes the loan from active records and business numbers and returns its items to stock. You can restore it later from Deleted Loans."
          confirmLabel="Delete Loan"
          pendingLabel="Deleting..."
          pending={deletingId !== null}
          error={deleteError}
          onConfirm={deleteLoan}
        />
      ) : null}

      {isAdmin ? (
        <PasswordConfirmDialog
          open={restoreTarget !== null}
          onOpenChange={(open) => {
            if (!open && !restoringId) {
              setRestoreTarget(null)
              setRestoreError(null)
            }
          }}
          title="Restore loan?"
          description="This returns the loan to the active list and business numbers, and deducts its items from stock again."
          confirmLabel="Restore Loan"
          pendingLabel="Restoring..."
          confirmVariant="default"
          pending={restoringId !== null}
          error={restoreError}
          onConfirm={handleRestore}
        />
      ) : null}
    </div>
  )
}
