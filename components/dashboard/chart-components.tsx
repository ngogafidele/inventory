export function ChartPlaceholder({ title }: { title: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-card p-6 text-sm text-muted-foreground">
      {title} chart placeholder
    </div>
  )
}
