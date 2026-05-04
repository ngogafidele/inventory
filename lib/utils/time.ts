export const KIGALI_TIME_ZONE = "Africa/Kigali"
const KIGALI_OFFSET_MINUTES = 120
const KIGALI_OFFSET_MS = KIGALI_OFFSET_MINUTES * 60 * 1000

type DateParts = {
  year: number
  month: number
  day: number
  hour: number
  minute: number
  second: number
}

function pad2(value: number) {
  return String(value).padStart(2, "0")
}

export function getKigaliDateParts(date: Date) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: KIGALI_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  })

  const parts: DateParts = {
    year: 0,
    month: 0,
    day: 0,
    hour: 0,
    minute: 0,
    second: 0,
  }

  for (const part of formatter.formatToParts(date)) {
    if (part.type in parts) {
      parts[part.type as keyof DateParts] = Number(part.value)
    }
  }

  return parts
}

export function formatInKigali(
  dateInput: Date | string | undefined,
  options: Intl.DateTimeFormatOptions
) {
  if (!dateInput) return "-"

  const date = typeof dateInput === "string" ? new Date(dateInput) : dateInput
  return new Intl.DateTimeFormat("en-US", {
    ...options,
    timeZone: KIGALI_TIME_ZONE,
  }).format(date)
}

export function formatKigaliDateInput(dateInput: Date | string | undefined) {
  if (!dateInput) return ""

  const date = typeof dateInput === "string" ? new Date(dateInput) : dateInput
  const parts = getKigaliDateParts(date)
  return `${parts.year}-${pad2(parts.month)}-${pad2(parts.day)}`
}

export function parseKigaliDateInput(value: string | undefined) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null
  }

  const [yearRaw, monthRaw, dayRaw] = value.split("-")
  const year = Number(yearRaw)
  const month = Number(monthRaw)
  const day = Number(dayRaw)

  if (
    Number.isNaN(year) ||
    Number.isNaN(month) ||
    Number.isNaN(day) ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31
  ) {
    return null
  }

  const utcMidnight = Date.UTC(year, month - 1, day, 0, 0, 0, 0)
  // Kigali stays on CAT (UTC+2) year-round, so a fixed offset is safe here.
  return new Date(utcMidnight - KIGALI_OFFSET_MS)
}
