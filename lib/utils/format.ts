export function formatCurrency(value: number) {
  const formatted = new Intl.NumberFormat("en-RW", {
    maximumFractionDigits: 2,
  }).format(value)
  return `${formatted} Rwf`
}
