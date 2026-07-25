"use client"

// Read-only modal that reconstructs and visualizes a product's stock movements.
import { useEffect, useMemo, useState } from "react"
import { ArrowDownRight, ArrowUpRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { formatInKigali } from "@/lib/utils/time"
import {
  StockBalanceChart,
  StockBreakdownChart,
  type BalancePoint,
  type BreakdownBar,
} from "@/components/products/stock-movement-charts"

export type MonitorProduct = {
  _id: string
  name: string
  sku: string
  unit: string
}

type MovementDirection = "in" | "out"

type MovementEvent = {
  date: string
  type: string
  direction: MovementDirection
  quantity: number
  reason: string
  balanceAfter: number
}

type MovementData = {
  openingBalance: number
  currentQuantity: number
  totals: { in: number; out: number; net: number }
  breakdown: (BreakdownBar & { type: string; count: number })[]
  balanceSeries: BalancePoint[]
  events: MovementEvent[]
}

// A range-scoped projection of the full history, derived on the client.
type MovementView = {
  openingBalance: number
  totals: { in: number; out: number; net: number }
  breakdown: BreakdownBar[]
  balanceSeries: BalancePoint[]
  events: MovementEvent[]
  hasEvents: boolean
}

const DAY_MS = 24 * 60 * 60 * 1000

const RANGES: { key: string; label: string; days: number | null }[] = [
  { key: "30d", label: "30 days", days: 30 },
  { key: "90d", label: "90 days", days: 90 },
  { key: "365d", label: "1 year", days: 365 },
  { key: "all", label: "All time", days: null },
]

function resolveGranularity(series: BalancePoint[]): "day" | "month" {
  if (series.length < 2) return "day"
  const first = new Date(series[0].date).getTime()
  const last = new Date(series[series.length - 1].date).getTime()
  return last - first > 120 * DAY_MS ? "month" : "day"
}

function signedQuantity(event: MovementEvent) {
  return event.direction === "in" ? event.quantity : -event.quantity
}

// Projects the full movement history onto the selected time window.
function deriveView(data: MovementData, days: number | null): MovementView {
  if (days == null) {
    return {
      openingBalance: data.openingBalance,
      totals: data.totals,
      breakdown: data.breakdown,
      balanceSeries: data.balanceSeries,
      events: data.events,
      hasEvents: data.events.length > 0,
    }
  }

  const labelByType = new Map(data.breakdown.map((bar) => [bar.type, bar.label]))
  const cutoff = Date.now() - days * DAY_MS
  // API events are newest-first; walk oldest-first for the window math.
  const ascending = [...data.events].reverse()
  const inRange = ascending.filter(
    (event) => new Date(event.date).getTime() >= cutoff
  )

  // Opening balance = stock level just before the first in-window movement.
  const opening =
    inRange.length > 0
      ? inRange[0].balanceAfter - signedQuantity(inRange[0])
      : data.currentQuantity

  const totalIn = inRange
    .filter((event) => event.direction === "in")
    .reduce((sum, event) => sum + event.quantity, 0)
  const totalOut = inRange
    .filter((event) => event.direction === "out")
    .reduce((sum, event) => sum + event.quantity, 0)

  const breakdownMap = new Map<
    string,
    { label: string; direction: MovementDirection; quantity: number }
  >()
  for (const event of inRange) {
    const existing = breakdownMap.get(event.type)
    if (existing) {
      existing.quantity += event.quantity
    } else {
      breakdownMap.set(event.type, {
        label: labelByType.get(event.type) ?? event.reason,
        direction: event.direction,
        quantity: event.quantity,
      })
    }
  }

  const balanceSeries: BalancePoint[] = [
    { date: new Date(cutoff).toISOString(), balance: opening },
    ...inRange.map((event) => ({ date: event.date, balance: event.balanceAfter })),
  ]

  return {
    openingBalance: opening,
    totals: { in: totalIn, out: totalOut, net: totalIn - totalOut },
    breakdown: Array.from(breakdownMap.values()),
    balanceSeries,
    events: [...inRange].reverse(),
    hasEvents: inRange.length > 0,
  }
}

function StatTile({
  label,
  value,
  unit,
}: {
  label: string
  value: number
  unit: string
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 text-lg font-semibold">
        {value}
        <span className="ml-1 text-xs font-normal text-muted-foreground">
          {unit}
        </span>
      </p>
    </div>
  )
}

export function ProductMonitorDialog({
  product,
  open,
  onOpenChange,
}: {
  product: MonitorProduct | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const [data, setData] = useState<MovementData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [rangeKey, setRangeKey] = useState<string>("all")

  useEffect(() => {
    if (!open || !product) return

    let active = true
    setLoading(true)
    setError(null)
    setData(null)
    setRangeKey("all")

    fetch(`/api/products/${product._id}/movements`)
      .then(async (response) => {
        const body = await response.json().catch(() => null)
        if (!response.ok || !body?.success) {
          throw new Error(body?.error ?? "Failed to load stock movements.")
        }
        if (active) setData(body.data as MovementData)
      })
      .catch((fetchError: unknown) => {
        if (active) {
          setError(
            fetchError instanceof Error
              ? fetchError.message
              : "Failed to load stock movements."
          )
        }
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [open, product])

  const unit = product?.unit ?? "pcs"
  const activeDays = RANGES.find((range) => range.key === rangeKey)?.days ?? null
  const view = useMemo(
    () => (data ? deriveView(data, activeDays) : null),
    [data, activeDays]
  )
  const granularity = view ? resolveGranularity(view.balanceSeries) : "day"
  const hasAnyHistory = (data?.events.length ?? 0) > 0

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] gap-4 overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Stock monitor — {product?.name ?? "Product"}</DialogTitle>
          <DialogDescription>
            {product ? `SKU ${product.sku}` : ""} · How this product moved in and
            out of stock over time.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex h-56 items-center justify-center text-sm text-muted-foreground">
            Loading stock movements…
          </div>
        ) : error ? (
          <div className="flex h-40 items-center justify-center text-sm text-destructive">
            {error}
          </div>
        ) : data && view ? (
          <div className="space-y-5">
            {hasAnyHistory ? (
              <div className="flex flex-wrap gap-1.5">
                {RANGES.map((range) => (
                  <Button
                    key={range.key}
                    size="sm"
                    variant={rangeKey === range.key ? "default" : "outline"}
                    onClick={() => setRangeKey(range.key)}
                  >
                    {range.label}
                  </Button>
                ))}
              </div>
            ) : null}

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <StatTile
                label="Opening"
                value={view.openingBalance}
                unit={unit}
              />
              <StatTile label="Total in" value={view.totals.in} unit={unit} />
              <StatTile label="Total out" value={view.totals.out} unit={unit} />
              <StatTile
                label="Current"
                value={data.currentQuantity}
                unit={unit}
              />
            </div>

            {!view.hasEvents ? (
              <div className="rounded-xl border border-dashed border-border bg-muted/30 p-6 text-center text-sm text-muted-foreground">
                {hasAnyHistory
                  ? "No stock movements in this time range."
                  : "No stock movements recorded yet for this product."}
              </div>
            ) : (
              <>
                <section className="space-y-2">
                  <h3 className="text-sm font-semibold">Stock level over time</h3>
                  <div className="rounded-xl border border-border bg-card p-3">
                    <StockBalanceChart
                      data={view.balanceSeries}
                      granularity={granularity}
                      unit={unit}
                    />
                  </div>
                </section>

                <section className="space-y-2">
                  <h3 className="text-sm font-semibold">
                    Movement volume by reason
                  </h3>
                  <div className="rounded-xl border border-border bg-card p-3">
                    <StockBreakdownChart data={view.breakdown} unit={unit} />
                  </div>
                  <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1.5">
                      <span
                        className="size-2.5 rounded-full"
                        style={{ background: "var(--chart-1)" }}
                      />
                      Stock in
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span
                        className="size-2.5 rounded-full"
                        style={{ background: "var(--chart-2)" }}
                      />
                      Stock out
                    </span>
                  </div>
                </section>

                <section className="space-y-2">
                  <h3 className="text-sm font-semibold">Movement history</h3>
                  <div className="overflow-hidden rounded-xl border border-border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Date</TableHead>
                          <TableHead>Movement</TableHead>
                          <TableHead>Reason</TableHead>
                          <TableHead className="text-right">Change</TableHead>
                          <TableHead className="text-right">Balance</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {view.events.map((event, index) => {
                          const isIn = event.direction === "in"
                          return (
                            <TableRow key={`${event.date}-${index}`}>
                              <TableCell className="text-muted-foreground">
                                {formatInKigali(event.date, {
                                  year: "numeric",
                                  month: "short",
                                  day: "2-digit",
                                })}
                              </TableCell>
                              <TableCell>
                                <span
                                  className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium ${
                                    isIn
                                      ? "bg-success/10 text-success"
                                      : "bg-warning/10 text-warning"
                                  }`}
                                >
                                  {isIn ? (
                                    <ArrowUpRight className="size-3" />
                                  ) : (
                                    <ArrowDownRight className="size-3" />
                                  )}
                                  {isIn ? "In" : "Out"}
                                </span>
                              </TableCell>
                              <TableCell>{event.reason}</TableCell>
                              <TableCell
                                className={`text-right font-medium ${
                                  isIn ? "text-success" : "text-warning"
                                }`}
                              >
                                {isIn ? "+" : "−"}
                                {event.quantity} {unit}
                              </TableCell>
                              <TableCell className="text-right">
                                {event.balanceAfter} {unit}
                              </TableCell>
                            </TableRow>
                          )
                        })}
                      </TableBody>
                    </Table>
                  </div>
                  {activeDays == null && view.openingBalance !== 0 ? (
                    <p className="text-xs text-muted-foreground">
                      Opening balance of {view.openingBalance} {unit} reflects
                      stock set directly on the product (creation or edits) before
                      the first recorded movement.
                    </p>
                  ) : null}
                </section>
              </>
            )}
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
