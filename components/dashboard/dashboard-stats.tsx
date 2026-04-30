"use client"

import { useEffect, useState } from "react"
import {
  AlertTriangle,
  Boxes,
  Coins,
  PackageSearch,
  Loader2,
  ReceiptText,
} from "lucide-react"
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
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        Loading dashboard stats...
      </div>
    )
  }

  if (!stats) {
    return <p className="text-sm text-muted-foreground">No stats available.</p>
  }

  const cards = [
    { label: "Products", value: stats.productCount, icon: Boxes },
    { label: "Low Stock", value: stats.lowStockCount, icon: AlertTriangle },
    { label: "Sales", value: stats.salesCount, icon: ReceiptText },
    { label: "Revenue", value: formatCurrency(stats.revenue), icon: Coins },
  ]

  return (
    <div className="space-y-5">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => (
          <div
            key={card.label}
            className="rounded-2xl border border-border/80 bg-background/80 p-4 shadow-sm"
          >
            <div className="flex items-center justify-between">
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
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

      <div className="grid gap-4">
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

      <div className="grid gap-4">
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
