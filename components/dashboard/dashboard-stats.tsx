"use client"

import { useEffect, useState } from "react"
import {
  AlertTriangle,
  Boxes,
  Coins,
  PackageSearch,
  ReceiptText,
  TrendingUp,
  Warehouse,
} from "lucide-react"
import { DashboardSkeleton } from "@/components/dashboard/dashboard-skeleton"
import { formatCurrency } from "@/lib/utils/format"
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
  grossProfitToday: number
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
    { label: "Products", value: stats.productCount, icon: Boxes },
    { label: "Low Stock", value: stats.lowStockCount, icon: AlertTriangle },
    {
      label: "Total Stock Value",
      value: formatCurrency(stats.stockValue),
      icon: Warehouse,
    },
    { label: "Sales Today", value: stats.salesToday, icon: ReceiptText },
    {
      label: "Revenue Today",
      value: formatCurrency(stats.revenueToday),
      icon: Coins,
    },
    {
      label: "Gross Profit Today",
      value: formatCurrency(stats.grossProfitToday),
      icon: TrendingUp,
    },
  ]

  return (
    <div className="space-y-14">
      <div className="grid gap-x-5 gap-y-12 md:grid-cols-2 xl:grid-cols-6">
        {cards.map((card) => (
          <div
            key={card.label}
            className="rounded-2xl border border-border/80 bg-background/80 p-4 shadow-sm"
          >
            <div className="flex items-center justify-between">
              <p className="max-w-[9rem] text-xs uppercase leading-4 tracking-[0.12em] text-muted-foreground">
                {card.label}
              </p>
              <card.icon className="size-4 text-primary" />
            </div>
            <p className="mt-2 text-2xl font-semibold text-foreground">
              {card.value}
            </p>
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
                      {new Date(sale.createdAt).toLocaleDateString()}
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
