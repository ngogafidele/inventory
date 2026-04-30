"use client"

import { useEffect, useState } from "react"
import { Loader2 } from "lucide-react"

type DashboardStatsProps = {
  store: "store1" | "store2"
}

type StatsResponse = {
  productCount: number
  lowStockCount: number
  salesCount: number
  invoiceCount: number
  revenue: number
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
    { label: "Products", value: stats.productCount },
    { label: "Low Stock", value: stats.lowStockCount },
    { label: "Sales", value: stats.salesCount },
    { label: "Invoices", value: stats.invoiceCount },
    { label: "Revenue", value: `$${stats.revenue.toFixed(2)}` },
  ]

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
      {cards.map((card) => (
        <div
          key={card.label}
          className="rounded-2xl border border-border bg-background p-4 shadow-sm"
        >
          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
            {card.label}
          </p>
          <p className="mt-2 text-2xl font-semibold text-foreground">
            {card.value}
          </p>
        </div>
      ))}
    </div>
  )
}
