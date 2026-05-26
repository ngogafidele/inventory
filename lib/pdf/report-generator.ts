import { createRequire } from "module"
import path from "node:path"
import type * as Fs from "node:fs"
import { STORE_LABELS, type StoreKey } from "@/lib/utils/constants"
import { formatCurrency } from "@/lib/utils/format"
import { formatInKigali } from "@/lib/utils/time"

const require = createRequire(import.meta.url)
const {
  existsSync,
  readFileSync,
}: {
  existsSync: typeof Fs.existsSync
  readFileSync: typeof Fs.readFileSync
} = require("node:fs")
const PDFKitModule = require("pdfkit") as
  | typeof import("pdfkit").default
  | {
      default?: typeof import("pdfkit").default
      PDFDocument?: typeof import("pdfkit").default
    }
const PDFDocument =
  typeof PDFKitModule === "function"
    ? PDFKitModule
    : PDFKitModule.default ?? PDFKitModule.PDFDocument

export type StoreReport = {
  store: StoreKey
  products: number
  inventoryCost: number
  inventoryRetail: number
  sales: number
  revenue: number
  costOfSales: number
  expenses: number
  profit: number
  invoices: number
  unpaidInvoices: number
  outstanding: number
  adjustments: number
}

export type TopMovingProduct = {
  sku: string
  name: string
  unit: string
  soldQuantity: number
  revenue: number
  grossProfit: number
}

export type RecentSale = {
  store: StoreKey
  createdAt?: Date | string
  totalAmount: number
  items: Array<{
    name: string
    sku: string
  }>
}

type ReportPdfPayload = {
  store: StoreKey
  fromLabel: string
  toLabel: string
  generatedAt?: Date | string
  reports: StoreReport[]
  topMovingProducts: TopMovingProduct[]
  recentSales: RecentSale[]
}

type ReportPdfDocument = {
  rect(x: number, y: number, width: number, height: number): ReportPdfDocument
  fillColor(color: string): ReportPdfDocument
  fill(): ReportPdfDocument
  image(
    src: string | Buffer,
    x?: number,
    y?: number,
    options?: { width?: number; height?: number; fit?: [number, number] }
  ): ReportPdfDocument
  font(name: string): ReportPdfDocument
  fontSize(size: number): ReportPdfDocument
  text(
    text: string,
    x?: number,
    y?: number,
    options?: { align?: "left" | "right" | "center"; width?: number }
  ): ReportPdfDocument
  lineTo(x: number, y: number): ReportPdfDocument
  moveTo(x: number, y: number): ReportPdfDocument
  lineWidth(width: number): ReportPdfDocument
  strokeColor(color: string): ReportPdfDocument
  stroke(): ReportPdfDocument
  addPage(): ReportPdfDocument
  widthOfString(text: string): number
  on(event: "data", listener: (chunk: Buffer) => void): ReportPdfDocument
  on(event: "end", listener: () => void): ReportPdfDocument
  on(event: "error", listener: (error: unknown) => void): ReportPdfDocument
  end(): void
}

const logoPath = path.join(process.cwd(), "public", "images", "logo.png")
const PRINT_TEXT = "#111827"
const PRINT_MUTED_TEXT = "#1f2937"
const PRINT_HEADER_TEXT = "#00183d"
const HEADER_FILL = "#eef3f8"
const ROW_FILL = "#fbfcfe"
const TABLE_ROW_HEIGHT = 24
const PAGE_LEFT = 48
const PAGE_RIGHT = 793
const PAGE_BOTTOM = 540

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US").format(value)
}

function formatDateTime(date: Date | string | undefined) {
  if (!date) return "-"
  return formatInKigali(date, {
    month: "short",
    day: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

function sumReports(reports: StoreReport[]) {
  return reports.reduce(
    (total, report) => ({
      products: total.products + report.products,
      inventoryCost: total.inventoryCost + report.inventoryCost,
      inventoryRetail: total.inventoryRetail + report.inventoryRetail,
      sales: total.sales + report.sales,
      revenue: total.revenue + report.revenue,
      costOfSales: total.costOfSales + report.costOfSales,
      expenses: total.expenses + report.expenses,
      profit: total.profit + report.profit,
      invoices: total.invoices + report.invoices,
      unpaidInvoices: total.unpaidInvoices + report.unpaidInvoices,
      outstanding: total.outstanding + report.outstanding,
      adjustments: total.adjustments + report.adjustments,
    }),
    {
      products: 0,
      inventoryCost: 0,
      inventoryRetail: 0,
      sales: 0,
      revenue: 0,
      costOfSales: 0,
      expenses: 0,
      profit: 0,
      invoices: 0,
      unpaidInvoices: 0,
      outstanding: 0,
      adjustments: 0,
    }
  )
}

function truncateToWidth(
  doc: ReportPdfDocument,
  value: string | undefined,
  width: number
) {
  const text = value?.trim() || "-"
  if (doc.widthOfString(text) <= width) return text

  const suffix = "..."
  const suffixWidth = doc.widthOfString(suffix)
  let start = 0
  let end = text.length

  while (start < end) {
    const mid = Math.ceil((start + end) / 2)
    if (doc.widthOfString(text.slice(0, mid)) + suffixWidth <= width) {
      start = mid
    } else {
      end = mid - 1
    }
  }

  return `${text.slice(0, start).trimEnd()}${suffix}`
}

function getLogoBuffer() {
  if (!existsSync(logoPath)) return null
  return readFileSync(logoPath)
}

function drawLogo(doc: ReportPdfDocument) {
  const logoBuffer = getLogoBuffer()
  try {
    if (!logoBuffer) throw new Error("Logo not found")
    doc.image(logoBuffer, 48, 30, { fit: [118, 118] })
  } catch {
    doc
      .font("Helvetica-Bold")
      .fontSize(16)
      .fillColor(PRINT_HEADER_TEXT)
      .text("B Ikaze Hardware", 48, 72, { width: 150 })
  }
}

function ensureSpace(doc: ReportPdfDocument, y: number, needed = TABLE_ROW_HEIGHT) {
  if (y + needed <= PAGE_BOTTOM) return y
  doc.addPage()
  return 56
}

function drawSectionTitle(doc: ReportPdfDocument, title: string, y: number) {
  doc
    .font("Helvetica-Bold")
    .fontSize(11)
    .fillColor(PRINT_HEADER_TEXT)
    .text(title, PAGE_LEFT, y)
  return y + 22
}

function drawHeaderRow(
  doc: ReportPdfDocument,
  y: number,
  columns: Array<{ label: string; x: number; width: number }>
) {
  doc.rect(PAGE_LEFT, y, PAGE_RIGHT - PAGE_LEFT, TABLE_ROW_HEIGHT).fillColor(HEADER_FILL).fill()
  doc.font("Helvetica-Bold").fontSize(8).fillColor(PRINT_HEADER_TEXT)
  columns.forEach((column) => {
    doc.text(column.label, column.x, y + 8, { width: column.width })
  })
  return y + TABLE_ROW_HEIGHT + 2
}

function drawDataRow(
  doc: ReportPdfDocument,
  y: number,
  columns: Array<{ text: string; x: number; width: number }>,
  index: number
) {
  doc
    .fillColor(index % 2 === 0 ? "#ffffff" : ROW_FILL)
    .rect(PAGE_LEFT, y - 7, PAGE_RIGHT - PAGE_LEFT, TABLE_ROW_HEIGHT)
    .fill()
    .font("Helvetica")
    .fontSize(8)
    .fillColor(PRINT_TEXT)

  columns.forEach((column) => {
    doc.text(truncateToWidth(doc, column.text, column.width), column.x, y, {
      width: column.width,
    })
  })

  return y + TABLE_ROW_HEIGHT + 2
}

function drawEmptyRow(doc: ReportPdfDocument, y: number, text: string) {
  doc
    .font("Helvetica")
    .fontSize(8)
    .fillColor(PRINT_MUTED_TEXT)
    .text(text, PAGE_LEFT + 6, y, { width: 300 })
  return y + TABLE_ROW_HEIGHT + 2
}

function drawMetrics(doc: ReportPdfDocument, y: number, totals: ReturnType<typeof sumReports>) {
  const metrics = [
    {
      label: "Total Revenue",
      value: formatCurrency(totals.revenue),
      fill: "#dff7ea",
      border: "#7fc99a",
    },
    {
      label: "Expenses",
      value: formatCurrency(totals.expenses),
      fill: "#ffe3e6",
      border: "#e58a96",
    },
    {
      label: "Profit",
      value: formatCurrency(totals.profit),
      fill: totals.profit >= 0 ? "#dcf7f0" : "#fff0cc",
      border: totals.profit >= 0 ? "#72c7ad" : "#d9a43b",
    },
    {
      label: "Inventory Cost",
      value: formatCurrency(totals.inventoryCost),
      fill: "#e7ebff",
      border: "#9ca9e8",
    },
    {
      label: "Inventory Retail",
      value: formatCurrency(totals.inventoryRetail),
      fill: "#ddf6fb",
      border: "#7bc7d5",
    },
    {
      label: "Sales Records",
      value: formatNumber(totals.sales),
      fill: "#f0e7ff",
      border: "#b79ae6",
    },
    {
      label: "Products",
      value: formatNumber(totals.products),
      fill: "#e8f8d7",
      border: "#a7d36b",
    },
    {
      label: "Loans",
      value: formatCurrency(totals.outstanding),
      fill: totals.outstanding > 0 ? "#ffe9d6" : "#eef2f7",
      border: totals.outstanding > 0 ? "#e4a166" : "#b9c3d0",
    },
  ]

  metrics.forEach((metric, index) => {
    const col = index % 4
    const row = Math.floor(index / 4)
    const x = PAGE_LEFT + col * 186
    const top = y + row * 54

    doc
      .rect(x, top, 174, 42)
      .fillColor(metric.fill)
      .fill()
      .rect(x, top, 174, 42)
      .lineWidth(1)
      .strokeColor(metric.border)
      .stroke()
      .rect(x, top, 4, 42)
      .fillColor(metric.border)
      .fill()
      .font("Helvetica-Bold")
      .fontSize(7)
      .fillColor(PRINT_MUTED_TEXT)
      .text(metric.label.toUpperCase(), x + 10, top + 8, { width: 156 })
      .fontSize(11)
      .fillColor(PRINT_TEXT)
      .text(truncateToWidth(doc, metric.value, 156), x + 10, top + 22, {
        width: 156,
      })
  })

  return y + 112
}

export function generateReportPDF(payload: ReportPdfPayload) {
  if (!PDFDocument) {
    const keys =
      typeof PDFKitModule === "object" && PDFKitModule !== null
        ? Object.keys(PDFKitModule).join(", ")
        : typeof PDFKitModule
    throw new Error(`Unable to load pdfkit constructor. Exports: ${keys}`)
  }

  const doc = new PDFDocument({
    margin: 48,
    size: "A4",
    layout: "landscape",
  }) as unknown as ReportPdfDocument
  const chunks: Buffer[] = []

  doc.on("data", (chunk: Buffer) => chunks.push(chunk))

  const done = new Promise<Buffer>((resolve, reject) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)))
    doc.on("error", reject)
  })

  drawLogo(doc)

  const storeName = STORE_LABELS[payload.store]
  const totals = sumReports(payload.reports)

  doc
    .font("Helvetica-Bold")
    .fontSize(22)
    .fillColor(PRINT_TEXT)
    .text(`${storeName} Report`, 460, 58, { align: "right", width: 330 })
    .font("Helvetica")
    .fontSize(10)
    .fillColor(PRINT_MUTED_TEXT)
    .text(`Period: ${payload.fromLabel} to ${payload.toLabel}`, 460, 88, {
      align: "right",
      width: 330,
    })
    .text(`Generated: ${formatDateTime(payload.generatedAt)}`, 460, 104, {
      align: "right",
      width: 330,
    })

  doc
    .moveTo(PAGE_LEFT, 170)
    .lineTo(PAGE_RIGHT, 170)
    .lineWidth(1.5)
    .strokeColor("#f08010")
    .stroke()

  let y = drawMetrics(doc, 194, totals)

  y = drawSectionTitle(doc, "Store Summary", y)
  const summaryColumns = [
    { label: "Store", x: 54, width: 120 },
    { label: "Revenue", x: 190, width: 96 },
    { label: "Expenses", x: 300, width: 96 },
    { label: "Profit", x: 410, width: 96 },
    { label: "Sales", x: 520, width: 70 },
    { label: "Products", x: 604, width: 70 },
    { label: "Loans", x: 688, width: 92 },
  ]
  y = drawHeaderRow(doc, y, summaryColumns)
  if (payload.reports.length === 0) {
    y = drawEmptyRow(doc, y, "No summary data found.")
  }
  payload.reports.forEach((report, index) => {
    y = ensureSpace(doc, y)
    y = drawDataRow(
      doc,
      y,
      [
        { text: STORE_LABELS[report.store], x: 54, width: 120 },
        { text: formatCurrency(report.revenue), x: 190, width: 96 },
        { text: formatCurrency(report.expenses), x: 300, width: 96 },
        { text: formatCurrency(report.profit), x: 410, width: 96 },
        { text: formatNumber(report.sales), x: 520, width: 70 },
        { text: formatNumber(report.products), x: 604, width: 70 },
        { text: formatCurrency(report.outstanding), x: 688, width: 92 },
      ],
      index
    )
  })

  y = ensureSpace(doc, y + 16, 110)
  y = drawSectionTitle(doc, "Top Moving Products", y)
  const productColumns = [
    { label: "#", x: 54, width: 24 },
    { label: "Product", x: 84, width: 250 },
    { label: "Sold", x: 360, width: 86 },
    { label: "Revenue", x: 486, width: 102 },
    { label: "Profit", x: 628, width: 102 },
  ]
  y = drawHeaderRow(doc, y, productColumns)
  if (payload.topMovingProducts.length === 0) {
    y = drawEmptyRow(doc, y, "No sales movement yet.")
  }
  payload.topMovingProducts.forEach((product, index) => {
    y = ensureSpace(doc, y)
    y = drawDataRow(
      doc,
      y,
      [
        { text: String(index + 1), x: 54, width: 24 },
        { text: `${product.name} (${product.sku})`, x: 84, width: 250 },
        {
          text: `${formatNumber(product.soldQuantity)} ${product.unit ?? "pcs"}`,
          x: 360,
          width: 86,
        },
        { text: formatCurrency(product.revenue), x: 486, width: 102 },
        { text: formatCurrency(product.grossProfit), x: 628, width: 102 },
      ],
      index
    )
  })

  y = ensureSpace(doc, y + 16, 110)
  y = drawSectionTitle(doc, "Recent Sales", y)
  const saleColumns = [
    { label: "Time", x: 54, width: 124 },
    { label: "Store", x: 194, width: 86 },
    { label: "Items", x: 304, width: 330 },
    { label: "Total", x: 670, width: 92 },
  ]
  y = drawHeaderRow(doc, y, saleColumns)
  if (payload.recentSales.length === 0) {
    y = drawEmptyRow(doc, y, "No sales recorded yet.")
  }
  payload.recentSales.forEach((sale, index) => {
    const items = sale.items
      .map((item) => item.name || item.sku)
      .filter(Boolean)
      .join(", ")

    y = ensureSpace(doc, y)
    y = drawDataRow(
      doc,
      y,
      [
        { text: formatDateTime(sale.createdAt), x: 54, width: 124 },
        { text: STORE_LABELS[sale.store], x: 194, width: 86 },
        { text: items || "-", x: 304, width: 330 },
        { text: formatCurrency(sale.totalAmount), x: 670, width: 92 },
      ],
      index
    )
  })

  y = ensureSpace(doc, y + 12, 42)
  doc
    .moveTo(PAGE_LEFT, y)
    .lineTo(PAGE_RIGHT, y)
    .strokeColor("#d8dee8")
    .stroke()
    .font("Helvetica")
    .fontSize(8)
    .fillColor(PRINT_MUTED_TEXT)
    .text(
      "This report is generated from the current inventory database and reflects transactions recorded for the selected date range.",
      PAGE_LEFT,
      y + 12,
      { width: PAGE_RIGHT - PAGE_LEFT }
    )

  doc.end()

  return done
}
