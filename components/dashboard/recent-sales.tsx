export type RecentSale = {
  id: string
  customer: string
  total: string
  date: string
}

export function RecentSales({ items }: { items: RecentSale[] }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
      <div className="mb-4">
        <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
          Recent Sales
        </p>
        <h3 className="text-lg font-semibold text-foreground">Latest</h3>
      </div>
      <div className="space-y-3">
        {items.map((item) => (
          <div
            key={item.id}
            className="flex items-center justify-between text-sm"
          >
            <div>
              <p className="font-medium text-foreground">{item.customer}</p>
              <p className="text-xs text-muted-foreground">{item.date}</p>
            </div>
            <p className="font-semibold text-foreground">{item.total}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
