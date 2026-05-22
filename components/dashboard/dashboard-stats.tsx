"use client"

import { useEffect, useState } from "react"
import {
  Boxes,
  Coins,
  Package,
  PackageSearch,
  ReceiptText,
  TrendingUp,
  Warehouse,
  Wallet,
} from "lucide-react"
import { DashboardSkeleton } from "@/components/dashboard/dashboard-skeleton"
import { formatCurrency } from "@/lib/utils/format"
import { formatInKigali } from "@/lib/utils/time"
import { cn } from "@/lib/utils"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

type DashboardStatsProps = {
  store: "store1" | "store2"
}

type StatsResponse = {
  productCount: number
  lowStockCount: number
  salesCount: number
  revenue: number
  salesToday: number
  stockValue: number
  revenueToday: number
  costOfSalesToday: number
  grossProfitToday: number
  expensesToday: number
  profitToday: number
  lowStockProducts: Array<{
    _id: string
    name: string
    sku: string
    quantity: number
    unit: string
    lowStockThreshold: number
  }>
  recentSales: Array<{
    _id: string
    createdAt: string
    totalAmount: number
    quantitySold: number
    units: string[]
  }>
  topMoving: Array<{
    sku: string
    name: string
    unit: string
    soldQuantity: number
    salesValue: number
  }>
}

export function DashboardStats({ store }: DashboardStatsProps) {
  const [stats, setStats] = useState<StatsResponse | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchStats = async () => {
      setLoading(true)
      const response = await fetch(`/api/dashboard/stats?store=${store}`)
      const data = await response.json()
      if (data?.success) {
        setStats(data.data)
      }
      setLoading(false)
    }

    fetchStats()
  }, [store])

  if (loading) {
    return <DashboardSkeleton />
  }

  if (!stats) {
    return <p className="text-sm text-muted-foreground">No stats available.</p>
  }

  const cards = [
    {
      label: "Products",
      value: stats.productCount,
      icon: Boxes,
      className: "border-lime-200 bg-lime-50 text-lime-950",
      iconClassName: "text-lime-700",
    },
    {
      label: "Total Stock Value",
      value: formatCurrency(stats.stockValue),
      icon: Warehouse,
      className: "border-indigo-200 bg-indigo-50 text-indigo-950",
      iconClassName: "text-indigo-700",
    },
    {
      label: "Sales Today",
      value: stats.salesToday,
      icon: ReceiptText,
      className: "border-violet-200 bg-violet-50 text-violet-950",
      iconClassName: "text-violet-700",
    },
    {
      label: "Revenue Today",
      value: formatCurrency(stats.revenueToday),
      icon: Coins,
      className: "border-emerald-200 bg-emerald-50 text-emerald-950",
      iconClassName: "text-emerald-700",
    },
    {
      label: "Cost of Sales",
      value: formatCurrency(stats.costOfSalesToday),
      icon: Package,
      className: "border-sky-200 bg-sky-50 text-sky-950",
      iconClassName: "text-sky-700",
    },
    {
      label: "Expenses Today",
      value: formatCurrency(stats.expensesToday),
      icon: Wallet,
      className: "border-rose-200 bg-rose-50 text-rose-950",
      iconClassName: "text-rose-700",
    },
    {
      label: "Profit Today",
      value: formatCurrency(stats.profitToday),
      icon: TrendingUp,
      className:
        stats.profitToday >= 0
          ? "border-teal-200 bg-teal-50 text-teal-950"
          : "border-amber-200 bg-amber-50 text-amber-950",
      iconClassName:
        stats.profitToday >= 0 ? "text-teal-700" : "text-amber-700",
    },
  ]

  return (
    <div className="space-y-14">
      <div className="grid gap-x-5 gap-y-12 md:grid-cols-2 xl:grid-cols-6">
        {cards.map((card) => (
          <div
            key={card.label}
            className={cn("rounded-2xl border p-4 shadow-sm", card.className)}
          >
            <div className="flex items-center justify-between">
              <p className="max-w-36 text-xs uppercase leading-4 tracking-[0.12em] opacity-70">
                {card.label}
              </p>
              <card.icon className={cn("size-4", card.iconClassName)} />
            </div>
            <p className="mt-2 text-2xl font-semibold">{card.value}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-12">
        <div className="rounded-2xl border border-border/80 bg-card p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                Sales Activity
              </p>
              <h3 className="text-lg font-semibold">Recent Sales</h3>
            </div>
            <ReceiptText className="size-4 text-primary" />
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Quantity Sold</TableHead>
                <TableHead>Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {stats.recentSales.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className="text-muted-foreground">
                    No sales recorded yet.
                  </TableCell>
                </TableRow>
              ) : (
                stats.recentSales.map((sale) => (
                  <TableRow key={sale._id}>
                    <TableCell>
                      {formatInKigali(sale.createdAt, {
                        year: "numeric",
                        month: "2-digit",
                        day: "2-digit",
                      })}
                    </TableCell>
                    <TableCell>
                      {sale.quantitySold} {sale.units.join("/")}
                    </TableCell>
                    <TableCell>{formatCurrency(sale.totalAmount)}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <div className="grid gap-12">
        <div className="rounded-2xl border border-border/80 bg-card p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                Product Performance
              </p>
              <h3 className="text-lg font-semibold">Top Moving Products</h3>
            </div>
            <PackageSearch className="size-4 text-primary" />
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product</TableHead>
                <TableHead>Sold</TableHead>
                <TableHead>Value</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {stats.topMoving.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className="text-muted-foreground">
                    No movement data yet.
                  </TableCell>
                </TableRow>
              ) : (
                stats.topMoving.map((item) => (
                  <TableRow key={item.sku}>
                    <TableCell>
                      <p className="font-medium">{item.name}</p>
                      <p className="text-xs text-muted-foreground">{item.sku}</p>
                    </TableCell>
                    <TableCell>
                      {item.soldQuantity} {item.unit}
                    </TableCell>
                    <TableCell>{formatCurrency(item.salesValue)}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  )
}
