// Renders income statement and balance sheet PDFs for a branch.
import { createRequire } from "module"
import path from "node:path"
import type * as Fs from "node:fs"
import { STORE_ADDRESSES, STORE_LABELS, type StoreKey } from "@/lib/utils/constants"
import { formatCurrency } from "@/lib/utils/format"
import { formatInKigali } from "@/lib/utils/time"
import type { BalanceSheet } from "@/lib/financial/balance-sheet"
import type { IncomeStatement } from "@/lib/financial/income-statement"

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

export type IncomeStatementPdfPayload = {
  store: StoreKey
  range: { from: string; to: string }
  generatedAt: Date
  statement: IncomeStatement
}

export type BalanceSheetPdfPayload = {
  store: StoreKey
  generatedAt: Date
  sheet: BalanceSheet
}

// Structural view of the pdfkit document, matching the other generators here.
type StatementPdfDocument = {
  on(event: "data", handler: (chunk: Buffer) => void): void
  on(event: "end", handler: () => void): void
  on(event: "error", handler: (error: Error) => void): void
  font(name: string): StatementPdfDocument
  fontSize(size: number): StatementPdfDocument
  fillColor(color: string): StatementPdfDocument
  strokeColor(color: string): StatementPdfDocument
  lineWidth(width: number): StatementPdfDocument
  text(
    text: string,
    x?: number,
    y?: number,
    options?: { width?: number; align?: string }
  ): StatementPdfDocument
  rect(x: number, y: number, width: number, height: number): StatementPdfDocument
  moveTo(x: number, y: number): StatementPdfDocument
  lineTo(x: number, y: number): StatementPdfDocument
  stroke(): StatementPdfDocument
  fill(): StatementPdfDocument
  image(
    source: Buffer,
    x: number,
    y: number,
    options?: { fit?: [number, number] }
  ): StatementPdfDocument
  addPage(): StatementPdfDocument
  end(): void
}

const logoPath = path.join(process.cwd(), "public", "images", "logo.png")
const PRINT_TEXT = "#111827"
const PRINT_MUTED_TEXT = "#1f2937"
const PRINT_HEADER_TEXT = "#00183d"
const HEADER_FILL = "#eef3f8"
const RULE_COLOR = "#d8dee8"

const PAGE_LEFT = 48
const PAGE_RIGHT = 547
const PAGE_BOTTOM = 780
const ROW_HEIGHT = 22
const AMOUNT_WIDTH = 130

function formatDateTime(date: Date | string | undefined) {
  return formatInKigali(date, {
    dateStyle: "medium",
    timeStyle: "short",
  })
}

function getLogoBuffer() {
  if (!existsSync(logoPath)) return null
  return readFileSync(logoPath)
}

function drawLogo(doc: StatementPdfDocument) {
  const logoBuffer = getLogoBuffer()
  try {
    if (!logoBuffer) throw new Error("Logo not found")
    doc.image(logoBuffer, PAGE_LEFT, 30, { fit: [96, 96] })
  } catch {
    doc
      .font("Helvetica-Bold")
      .fontSize(15)
      .fillColor(PRINT_HEADER_TEXT)
      .text("B Ikaze Hardware", PAGE_LEFT, 60, { width: 160 })
  }
}

function drawHeader(
  doc: StatementPdfDocument,
  title: string,
  store: StoreKey,
  subtitle: string,
  generatedAt: Date
) {
  drawLogo(doc)

  const rightX = 300
  const rightWidth = PAGE_RIGHT - rightX

  doc
    .font("Helvetica-Bold")
    .fontSize(19)
    .fillColor(PRINT_TEXT)
    .text(title, rightX, 44, { align: "right", width: rightWidth })
    .font("Helvetica")
    .fontSize(10)
    .fillColor(PRINT_MUTED_TEXT)
    .text(`${STORE_LABELS[store]} - ${STORE_ADDRESSES[store]}`, rightX, 70, {
      align: "right",
      width: rightWidth,
    })
    .text(subtitle, rightX, 86, { align: "right", width: rightWidth })
    .text(`Generated: ${formatDateTime(generatedAt)}`, rightX, 102, {
      align: "right",
      width: rightWidth,
    })

  return 140
}

function ensureSpace(doc: StatementPdfDocument, y: number, needed = ROW_HEIGHT) {
  if (y + needed <= PAGE_BOTTOM) return y
  doc.addPage()
  return 56
}

function drawSectionTitle(doc: StatementPdfDocument, title: string, y: number) {
  const top = ensureSpace(doc, y, 30)
  doc
    .rect(PAGE_LEFT, top, PAGE_RIGHT - PAGE_LEFT, ROW_HEIGHT)
    .fillColor(HEADER_FILL)
    .fill()
  doc
    .font("Helvetica-Bold")
    .fontSize(10)
    .fillColor(PRINT_HEADER_TEXT)
    .text(title, PAGE_LEFT + 8, top + 7, { width: 300 })
  return top + ROW_HEIGHT + 4
}

type RowOptions = {
  bold?: boolean
  ruleAbove?: boolean
  note?: string
}

function drawRow(
  doc: StatementPdfDocument,
  y: number,
  label: string,
  amount: number,
  options: RowOptions = {}
) {
  const needed = options.note ? ROW_HEIGHT + 12 : ROW_HEIGHT
  let top = ensureSpace(doc, y, needed)

  if (options.ruleAbove) {
    doc
      .strokeColor(RULE_COLOR)
      .lineWidth(1)
      .moveTo(PAGE_LEFT, top)
      .lineTo(PAGE_RIGHT, top)
      .stroke()
    top += 6
  }

  doc
    .font(options.bold ? "Helvetica-Bold" : "Helvetica")
    .fontSize(options.bold ? 11 : 10)
    .fillColor(options.bold ? PRINT_TEXT : PRINT_MUTED_TEXT)
    .text(label, PAGE_LEFT + 8, top + 5, {
      width: PAGE_RIGHT - PAGE_LEFT - AMOUNT_WIDTH - 24,
    })
    .text(formatCurrency(amount), PAGE_RIGHT - AMOUNT_WIDTH - 8, top + 5, {
      width: AMOUNT_WIDTH,
      align: "right",
    })

  let next = top + ROW_HEIGHT

  if (options.note) {
    doc
      .font("Helvetica")
      .fontSize(7.5)
      .fillColor(PRINT_MUTED_TEXT)
      .text(options.note, PAGE_LEFT + 8, next - 4, {
        width: PAGE_RIGHT - PAGE_LEFT - AMOUNT_WIDTH - 24,
      })
    next += 10
  }

  return next
}

function createDoc(): { doc: StatementPdfDocument; done: Promise<Buffer> } {
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
  }) as unknown as StatementPdfDocument

  const chunks: Buffer[] = []
  doc.on("data", (chunk: Buffer) => chunks.push(chunk))

  const done = new Promise<Buffer>((resolve, reject) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)))
    doc.on("error", reject)
  })

  return { doc, done }
}

export function generateIncomeStatementPDF(payload: IncomeStatementPdfPayload) {
  const { doc, done } = createDoc()
  const { statement } = payload

  let y = drawHeader(
    doc,
    "Income Statement",
    payload.store,
    `Period: ${payload.range.from} to ${payload.range.to}`,
    payload.generatedAt
  )

  y = drawSectionTitle(doc, "Trading", y)
  y = drawRow(doc, y, "Revenue", statement.revenue, {
    note: "Net of returns",
  })
  y = drawRow(doc, y, "Cost of Goods Sold", -statement.costOfGoodsSold)
  y = drawRow(doc, y, "Gross Profit", statement.grossProfit, {
    bold: true,
    ruleAbove: true,
  })

  y += 8
  y = drawSectionTitle(doc, "Operating", y)
  y = drawRow(doc, y, "Operating Expenses", -statement.operatingExpenses)
  y = drawRow(doc, y, "Net Profit", statement.netProfit, {
    bold: true,
    ruleAbove: true,
  })

  if (statement.revenue !== 0) {
    const margin = (statement.netProfit / statement.revenue) * 100
    y += 10
    doc
      .font("Helvetica")
      .fontSize(9)
      .fillColor(PRINT_MUTED_TEXT)
      .text(`Net margin: ${margin.toFixed(1)}% of revenue.`, PAGE_LEFT, y, {
        width: PAGE_RIGHT - PAGE_LEFT,
      })
  }

  doc.end()
  return done
}

function drawLineGroup(
  doc: StatementPdfDocument,
  y: number,
  title: string,
  lines: BalanceSheet["assets"]["current"]
) {
  let next = drawSectionTitle(doc, title, y)
  if (lines.length === 0) {
    next = drawRow(doc, next, "None recorded", 0)
    return next
  }

  for (const line of lines) {
    next = drawRow(doc, next, line.label, line.amount, { note: line.note })
  }
  return next
}

export function generateBalanceSheetPDF(payload: BalanceSheetPdfPayload) {
  const { doc, done } = createDoc()
  const { sheet } = payload

  let y = drawHeader(
    doc,
    "Balance Sheet",
    payload.store,
    `As of: ${sheet.asOf}`,
    payload.generatedAt
  )

  y = drawLineGroup(doc, y, "Current Assets", sheet.assets.current)
  y += 6
  y = drawLineGroup(doc, y, "Fixed Assets", sheet.assets.fixed)
  y = drawRow(doc, y, "Total Assets", sheet.totalAssets, {
    bold: true,
    ruleAbove: true,
  })

  y += 10
  y = drawLineGroup(doc, y, "Current Liabilities", sheet.liabilities.current)
  y += 6
  y = drawLineGroup(doc, y, "Long-term Liabilities", sheet.liabilities.longTerm)
  y += 6
  y = drawLineGroup(doc, y, "Equity", sheet.equity.lines)
  y = drawRow(
    doc,
    y,
    "Total Liabilities & Equity",
    sheet.totalLiabilitiesAndEquity,
    { bold: true, ruleAbove: true }
  )

  // Reported plainly rather than forced to zero, matching the on-screen sheet.
  if (Math.round(sheet.balanceDifference) !== 0) {
    y += 10
    y = ensureSpace(doc, y, 34)
    doc
      .font("Helvetica-Bold")
      .fontSize(9)
      .fillColor(PRINT_TEXT)
      .text(
        `Out of balance by ${formatCurrency(sheet.balanceDifference)}.`,
        PAGE_LEFT,
        y,
        { width: PAGE_RIGHT - PAGE_LEFT }
      )
    doc
      .font("Helvetica")
      .fontSize(8)
      .fillColor(PRINT_MUTED_TEXT)
      .text(
        "Owner capital and drawings are not tracked automatically; record them as manual equity items.",
        PAGE_LEFT,
        y + 13,
        { width: PAGE_RIGHT - PAGE_LEFT }
      )
    y += 30
  }

  if (sheet.inventoryWarnings.length > 0) {
    y += 6
    y = ensureSpace(doc, y, 30)
    doc
      .font("Helvetica")
      .fontSize(8)
      .fillColor(PRINT_MUTED_TEXT)
      .text(
        `Inconsistent stock history, excluded from inventory value: ${sheet.inventoryWarnings.join(
          ", "
        )}.`,
        PAGE_LEFT,
        y,
        { width: PAGE_RIGHT - PAGE_LEFT }
      )
  }

  doc.end()
  return done
}
