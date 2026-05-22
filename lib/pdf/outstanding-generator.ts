import { createRequire } from "module"
import path from "node:path"
import type * as Fs from "node:fs"
import { formatCurrency } from "@/lib/utils/format"

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

type OutstandingSaleRow = {
  saleDate?: Date | string
  paymentDate?: Date | string
  items: string
  pricePerUnit: number | null
  recordedBy: string
  amount: number
}

type OutstandingPdfPayload = {
  statementNumber: string
  generatedAt?: Date | string
  customerName: string
  customerPhone?: string
  totalOutstanding: number
  rows: OutstandingSaleRow[]
}

type StoreInfo = {
  name?: string
  address?: string
  phone?: string
  email?: string
}

type OutstandingPdfDocument = {
  rect(x: number, y: number, width: number, height: number): OutstandingPdfDocument
  fillColor(color: string): OutstandingPdfDocument
  fill(): OutstandingPdfDocument
  image(
    src: string | Buffer,
    x?: number,
    y?: number,
    options?: { width?: number; height?: number; fit?: [number, number] }
  ): OutstandingPdfDocument
  font(name: string): OutstandingPdfDocument
  fontSize(size: number): OutstandingPdfDocument
  text(
    text: string,
    x?: number,
    y?: number,
    options?: { align?: "left" | "right" | "center"; width?: number }
  ): OutstandingPdfDocument
  lineTo(x: number, y: number): OutstandingPdfDocument
  moveTo(x: number, y: number): OutstandingPdfDocument
  lineWidth(width: number): OutstandingPdfDocument
  strokeColor(color: string): OutstandingPdfDocument
  stroke(): OutstandingPdfDocument
  addPage(): OutstandingPdfDocument
  heightOfString(text: string, options?: { width?: number }): number
  widthOfString(text: string): number
  on(event: "data", listener: (chunk: Buffer) => void): OutstandingPdfDocument
  on(event: "end", listener: () => void): OutstandingPdfDocument
  on(event: "error", listener: (error: unknown) => void): OutstandingPdfDocument
  end(): void
}

const logoPath = path.join(process.cwd(), "public", "images", "logo.png")
const stampPath = path.join(process.cwd(), "public", "images", "stamp.jpg")
const logoBox = {
  x: 42,
  y: 24,
  width: 174,
  height: 174,
  imageX: 48,
  imageY: 30,
  imageFit: [162, 162] as [number, number],
}

const stampBox = {
  x: 438,
  width: 78,
  height: 78,
  fit: [78, 78] as [number, number],
}

const paymentMethodsLines = [
  "Equity Bank Account: 4005201187639",
  "Tin: 111049695",
  "Tel No: 0788399098",
  "",
  "B Ikaze Hardware",
]

const PRINT_TEXT = "#111827"
const PRINT_MUTED_TEXT = "#1f2937"
const PRINT_HEADER_TEXT = "#00183d"
const TABLE_ROW_HEIGHT = 24

function mutedText(doc: OutstandingPdfDocument) {
  return doc.font("Helvetica").fillColor(PRINT_MUTED_TEXT)
}

function boldText(doc: OutstandingPdfDocument) {
  return doc.font("Helvetica-Bold").fillColor(PRINT_TEXT)
}

function getLogoBuffer() {
  if (!existsSync(logoPath)) return null
  return readFileSync(logoPath)
}

function getStampBuffer() {
  if (!existsSync(stampPath)) return null
  return readFileSync(stampPath)
}

function drawLogo(doc: OutstandingPdfDocument, storeInfo: StoreInfo) {
  doc
    .rect(logoBox.x, logoBox.y, logoBox.width, logoBox.height)
    .fillColor("#ffffff")
    .fill()

  const logoBuffer = getLogoBuffer()
  try {
    if (!logoBuffer) throw new Error("Logo not found")
    doc.image(logoBuffer, logoBox.imageX, logoBox.imageY, {
      fit: logoBox.imageFit,
    })
    return
  } catch (bufferError) {
    try {
      doc.image(logoPath, logoBox.imageX, logoBox.imageY, {
        fit: logoBox.imageFit,
      })
      return
    } catch (pathError) {
      console.error("[Outstanding PDF Logo Error]", {
        buffer:
          bufferError instanceof Error
            ? bufferError.message
            : "Failed to load logo buffer",
        path:
          pathError instanceof Error
            ? pathError.message
            : "Failed to load logo path",
        logoPath,
      })
      doc
        .font("Helvetica-Bold")
        .fontSize(16)
        .fillColor(PRINT_HEADER_TEXT)
        .text(storeInfo.name ?? "Inventory", 48, 72, { width: 150 })
    }
  }
}

function drawStamp(doc: OutstandingPdfDocument, y: number) {
  const stampBuffer = getStampBuffer()
  const stampY = y + 34

  try {
    if (!stampBuffer) throw new Error("Stamp not found")
    doc.image(stampBuffer, stampBox.x, stampY, { fit: stampBox.fit })
  } catch (bufferError) {
    try {
      doc.image(stampPath, stampBox.x, stampY, { fit: stampBox.fit })
    } catch (pathError) {
      console.error("[Outstanding PDF Stamp Error]", {
        buffer:
          bufferError instanceof Error
            ? bufferError.message
            : "Failed to load stamp buffer",
        path:
          pathError instanceof Error
            ? pathError.message
            : "Failed to load stamp path",
        stampPath,
      })
    }
  }
}

function formatDate(value: Date | string | undefined) {
  if (!value) return "-"
  return new Intl.DateTimeFormat("en-RW", {
    year: "numeric",
    month: "short",
    day: "2-digit",
  }).format(new Date(value))
}

function truncateToWidth(
  doc: OutstandingPdfDocument,
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

export function generateOutstandingCustomerPDF(
  payload: OutstandingPdfPayload,
  storeInfo: StoreInfo
) {
  if (!PDFDocument) {
    const keys =
      typeof PDFKitModule === "object" && PDFKitModule !== null
        ? Object.keys(PDFKitModule).join(", ")
        : typeof PDFKitModule
    throw new Error(`Unable to load pdfkit constructor. Exports: ${keys}`)
  }

  const doc = new PDFDocument({ margin: 48, size: "A4" }) as unknown as OutstandingPdfDocument
  const chunks: Buffer[] = []

  doc.on("data", (chunk: Buffer) => chunks.push(chunk))

  const done = new Promise<Buffer>((resolve, reject) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)))
    doc.on("error", reject)
  })

  drawLogo(doc, storeInfo)

  // Compute a safe header bottom so subsequent content doesn't overlap
  // with the title/logo area. Use font metrics to measure text heights.
  const titleFont = "Helvetica-Bold"
  const bodyFont = "Helvetica"
  doc.font(titleFont).fontSize(22)
  const titleHeight = doc.heightOfString("Outstanding Statement", { width: 200 })
  doc.font(bodyFont).fontSize(10)
  const stmtHeight = doc.heightOfString(String(payload.statementNumber ?? ""), { width: 200 })
  const dateHeight = doc.heightOfString(`Date: ${formatDate(payload.generatedAt)}`, { width: 200 })

  // Compute header bottom using the actual title position and measured heights
  const titleY = logoBox.y + 12
  const stmtY = titleY + titleHeight + 6
  const dateY = stmtY + stmtHeight
  const headerBottom = Math.max(logoBox.y + logoBox.height, dateY + dateHeight)

  const separatorY = Math.ceil(headerBottom + 16)

  // Draw title and statement on the right side within the computed header area
  const titleX = 340
  boldText(doc).fontSize(22).text("Loan Statement", titleX, titleY, { align: "right" })
  mutedText(doc)
    .fontSize(10)
    .text(payload.statementNumber, titleX, stmtY, { align: "right" })
    .text(`Date: ${formatDate(payload.generatedAt)}`, titleX, dateY, {
      align: "right",
    })

  doc.moveTo(48, separatorY).lineTo(547, separatorY).lineWidth(1.5).strokeColor("#f08010").stroke()

  const contentStart = separatorY + 20

  boldText(doc).fontSize(11).text(storeInfo.name ?? "Multi-Store Inventory", 48, contentStart)
  mutedText(doc)
    .fontSize(9)
    .text(storeInfo.address ?? "", 48, contentStart + 18)
    .text(storeInfo.phone ?? "", 48, contentStart + 32)
    .text(storeInfo.email ?? "", 48, contentStart + 46)

  boldText(doc).fontSize(11).text("Customer", 330, contentStart)
  mutedText(doc)
    .fontSize(9)
    .text(payload.customerName, 330, contentStart + 18)
    .text(payload.customerPhone ?? "", 330, contentStart + 32)

  const tableTop = contentStart + 90
  const columns = {
    saleDate: 54,
    paymentDate: 122,
    items: 176,
    recordedBy: 326,
    pricePerUnit: 404,
    amount: 478,
  }

  doc
    .rect(48, tableTop, 499, 24)
    .fillColor("#eef3f8")
    .fill()
    .font("Helvetica-Bold")
    .fillColor(PRINT_HEADER_TEXT)
    .fontSize(9)
    .text("Sale Date", columns.saleDate, tableTop + 8)
    .text("Payment", columns.paymentDate, tableTop + 8)
    .text("Items", columns.items, tableTop + 8)
    .text("Recorded", columns.recordedBy, tableTop + 8)
    .text("Price / unit", columns.pricePerUnit, tableTop + 8)
    .text("Amount", columns.amount, tableTop + 8)

  let y = tableTop + 32

  payload.rows.forEach((row, index) => {
    const costText = row.pricePerUnit === null ? "-" : formatCurrency(row.pricePerUnit)

    if (y + TABLE_ROW_HEIGHT > 700) {
      doc.addPage()
      y = 56
    }

    doc.font("Helvetica").fontSize(9)
    const saleDate = truncateToWidth(doc, formatDate(row.saleDate), 70)
    const paymentDate = truncateToWidth(doc, formatDate(row.paymentDate), 70)
    const items = truncateToWidth(doc, row.items, 122)
    const recordedBy = truncateToWidth(doc, row.recordedBy, 70)
    const pricePerUnit = truncateToWidth(doc, costText, 70)
    const amount = truncateToWidth(doc, formatCurrency(row.amount), 60)

    doc
      .fillColor(index % 2 === 0 ? "#ffffff" : "#fbfcfe")
      .rect(48, y - 6, 499, TABLE_ROW_HEIGHT)
      .fill()
      .font("Helvetica")
      .fillColor(PRINT_TEXT)
      .fontSize(9)
      .text(saleDate, columns.saleDate, y, { width: 70 })
      .text(paymentDate, columns.paymentDate, y, { width: 70 })
      .text(items, columns.items, y, { width: 122 })
      .text(recordedBy, columns.recordedBy, y, { width: 70 })
      .text(pricePerUnit, columns.pricePerUnit, y, { width: 70 })
      .text(amount, columns.amount, y, { width: 60 })

    y += TABLE_ROW_HEIGHT + 2
  })

  if (y > 660) {
    doc.addPage()
    y = 56
  }

  doc
    .moveTo(48, y)
    .lineTo(547, y)
    .strokeColor("#d8dee8")
    .stroke()
    .font("Helvetica-Bold")
    .fontSize(12)
    .fillColor(PRINT_TEXT)
    .text("Total Loans", 330, y + 16)
    .text(formatCurrency(payload.totalOutstanding), 448, y + 16, {
      width: 90,
    })

  drawStamp(doc, y)

  const paymentBlockY = y + 56
  doc
    .font("Helvetica-Bold")
    .fontSize(9)
    .fillColor(PRINT_TEXT)
    .text(paymentMethodsLines.join("\n"), 48, paymentBlockY, {
      width: 220,
    })

  doc.end()

  return done
}
