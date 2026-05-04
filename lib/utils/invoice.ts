import { getKigaliDateParts } from "@/lib/utils/time"

export function generateInvoiceNumber() {
  const nowParts = getKigaliDateParts(new Date())
  const yyyy = nowParts.year
  const mm = String(nowParts.month).padStart(2, "0")
  const dd = String(nowParts.day).padStart(2, "0")
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase()
  return `INV-${yyyy}${mm}${dd}-${rand}`
}
