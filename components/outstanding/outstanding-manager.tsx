"use client"

import { useMemo, useState } from "react"
import { Download, Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
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
import { formatInKigali } from "@/lib/utils/time"

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

export function OutstandingManager({
  initialSales,
}: {
  initialSales: OutstandingSale[]
}) {
  const [sales, setSales] = useState(initialSales)
  const [search, setSearch] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [updatingId, setUpdatingId] = useState<string | null>(null)

  const filteredSales = useMemo(() => {
    const query = search.trim().toLowerCase()
    const normalizedQuery = normalizeSearchText(search.trim())
    if (!query) return sales

    return sales.filter((sale) => {
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
    })
  }, [sales, search])

  const totalOutstanding = useMemo(() => {
    return filteredSales.reduce((sum, sale) => sum + sale.totalAmount, 0)
  }, [filteredSales])

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

  const markPaid = async (saleId: string) => {
    setError(null)
    setUpdatingId(saleId)

    try {
      const response = await fetch(`/api/sales/${saleId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentStatus: "paid" }),
      })
      const body = await response.json().catch(() => null)

      if (!response.ok || !body?.success) {
        setError(body?.error ?? "Failed to mark sale as paid.")
        return
      }

      setSales((current) => current.filter((sale) => sale._id !== saleId))
    } catch {
      setError("Failed to mark sale as paid.")
    } finally {
      setUpdatingId(null)
    }
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

      <div className="grid gap-4 sm:grid-cols-2">
        <StatsCard label="Loan Sales" value={filteredSales.length} />
        <StatsCard
          label="Loans Total"
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
            <TableHead>Amount</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filteredSales.length === 0 ? (
            <TableRow>
                <TableCell colSpan={8} className="text-muted-foreground">
                No loans found.
              </TableCell>
            </TableRow>
          ) : (
            filteredSales.map((sale) => {
              const paymentDate = sale.outstanding?.paymentDate
              const paymentDateLabel = paymentDate
                ? formatInKigali(paymentDate, {
                    year: "numeric",
                    month: "short",
                    day: "2-digit",
                  })
                : "-"

              return (
                <TableRow key={sale._id}>
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
                        onClick={() => markPaid(sale._id)}
                        disabled={updatingId === sale._id}
                      >
                        {updatingId === sale._id ? "Updating..." : "Mark Paid"}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              )
            })
          )}
        </TableBody>
      </Table>
    </div>
  )
}
