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

type PdfItem = {
  description: string
  sku?: string
  unit?: string
  quantity: number
  unitPrice: number
  lineTotal: number
}

type PdfDocumentData = {
  number: string
  date?: Date | string
  customerName: string
  customerEmail?: string
  customerPhone?: string
  status?: string
  totalAmount: number
  items: PdfItem[]
}

type StoreInfo = {
  name?: string
  address?: string
  phone?: string
  email?: string
}

type InvoicePdfDocument = {
  rect(x: number, y: number, width: number, height: number): InvoicePdfDocument
  fillColor(color: string): InvoicePdfDocument
  fill(): InvoicePdfDocument
  image(
    src: string | Buffer,
    x?: number,
    y?: number,
    options?: { width?: number; height?: number; fit?: [number, number] }
  ): InvoicePdfDocument
  font(name: string): InvoicePdfDocument
  fontSize(size: number): InvoicePdfDocument
  text(
    text: string,
    x?: number,
    y?: number,
    options?: { align?: "left" | "right" | "center"; width?: number }
  ): InvoicePdfDocument
  widthOfString(text: string): number
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

const businessFooterLines = [
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

function mutedText(doc: InvoicePdfDocument) {
  return doc.font("Helvetica").fillColor(PRINT_MUTED_TEXT)
}

function boldText(doc: InvoicePdfDocument) {
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

function drawLogo(doc: InvoicePdfDocument, storeInfo: StoreInfo) {
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
      console.error("[Invoice PDF Logo Error]", {
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

function drawStamp(doc: InvoicePdfDocument, y: number) {
  const stampBuffer = getStampBuffer()
  const stampY = y + 34

  try {
    if (!stampBuffer) throw new Error("Stamp not found")
    doc.image(stampBuffer, stampBox.x, stampY, { fit: stampBox.fit })
  } catch (bufferError) {
    try {
      doc.image(stampPath, stampBox.x, stampY, { fit: stampBox.fit })
    } catch (pathError) {
      console.error("[Invoice PDF Stamp Error]", {
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
  doc: InvoicePdfDocument,
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

function writeInvoicePdf(
  title: string,
  data: PdfDocumentData,
  storeInfo: StoreInfo,
  recipientLabel = "Bill To",
  footerLines: string[] = [],
  centeredFooterLine?: string
) {
  if (!PDFDocument) {
    const keys =
      typeof PDFKitModule === "object" && PDFKitModule !== null
        ? Object.keys(PDFKitModule).join(", ")
        : typeof PDFKitModule
    throw new Error(`Unable to load pdfkit constructor. Exports: ${keys}`)
  }

  const doc = new PDFDocument({ margin: 48, size: "A4" })
  const chunks: Buffer[] = []

  doc.on("data", (chunk: Buffer) => chunks.push(chunk))

  const done = new Promise<Buffer>((resolve, reject) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)))
    doc.on("error", reject)
  })

  drawLogo(doc, storeInfo)

  boldText(doc)
    .fontSize(22)
    .text(title, 340, 58, { align: "right" })
  mutedText(doc)
    .fontSize(10)
    .text(data.number, 340, 88, { align: "right" })
    .text(`Date: ${formatDate(data.date)}`, 340, 104, { align: "right" })

  if (data.status) {
    doc.text(`Status: ${data.status}`, 340, 120, { align: "right" })
  }

  doc
    .moveTo(48, 210)
    .lineTo(547, 210)
    .lineWidth(1.5)
    .strokeColor("#f08010")
    .stroke()

  boldText(doc)
    .fontSize(11)
    .text(storeInfo.name ?? "Multi-Store Inventory", 48, 230)
  mutedText(doc)
    .fontSize(9)
    .text(storeInfo.address ?? "", 48, 248)
    .text(storeInfo.phone ?? "", 48, 262)
    .text(storeInfo.email ?? "", 48, 276)

  boldText(doc)
    .fontSize(11)
    .text(recipientLabel, 330, 230)
  mutedText(doc)
    .fontSize(9)
    .text(data.customerName, 330, 248)
    .text(data.customerEmail ?? "", 330, 262)
    .text(data.customerPhone ?? "", 330, 276)

  const tableTop = 320
  const columns = {
    item: 54,
    quantity: 286,
    price: 355,
    total: 448,
  }

  doc
    .rect(48, tableTop, 499, 24)
    .fillColor("#eef3f8")
    .fill()
    .font("Helvetica-Bold")
    .fillColor(PRINT_HEADER_TEXT)
    .fontSize(9)
    .text("Item", columns.item, tableTop + 8)
    .text("Qty", columns.quantity, tableTop + 8)
    .text("Price", columns.price, tableTop + 8)
    .text("Total", columns.total, tableTop + 8)

  let y = tableTop + 32
  data.items.forEach((item, index) => {
    if (y + TABLE_ROW_HEIGHT > 700) {
      doc.addPage()
      y = 56
    }

    doc.font("Helvetica").fontSize(9)
    const description = truncateToWidth(doc, item.description, 210)
    doc.font("Helvetica").fontSize(8)
    const sku = item.sku ? truncateToWidth(doc, item.sku, 210) : ""

    doc
      .fillColor(index % 2 === 0 ? "#ffffff" : "#fbfcfe")
      .rect(48, y - 7, 499, TABLE_ROW_HEIGHT)
      .fill()
      .font("Helvetica")
      .fillColor(PRINT_TEXT)
      .fontSize(9)
      .text(description, columns.item, y, { width: 210 })
      .fillColor(PRINT_MUTED_TEXT)
      .fontSize(8)
      .text(sku, columns.item, y + 10, { width: 210 })
      .font("Helvetica")
      .fillColor(PRINT_TEXT)
      .fontSize(9)
      .text(`${item.quantity} ${item.unit ?? "pcs"}`, columns.quantity, y)
      .text(formatCurrency(item.unitPrice), columns.price, y, { width: 82 })
      .text(formatCurrency(item.lineTotal), columns.total, y, { width: 92 })

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
    .fontSize(14)
    .fillColor(PRINT_TEXT)
    .text("Total", 355, y + 20)
    .text(formatCurrency(data.totalAmount), 448, y + 20, { width: 92 })

  drawStamp(doc, y)

  if (footerLines.length > 0) {
    let footerY = y + 58
    if (footerY > 700) {
      doc.addPage()
      footerY = 56
    }

    doc
      .font("Helvetica-Bold")
      .fontSize(9)
      .fillColor(PRINT_TEXT)
      .text(footerLines.join("\n"), 48, footerY, { width: 220 })

    if (centeredFooterLine) {
      const centeredFooterY = footerY + footerLines.length * 11 + 4

      doc
        .font("Helvetica-Bold")
        .fontSize(9)
        .fillColor(PRINT_TEXT)
        .text(centeredFooterLine, 48, centeredFooterY, {
          align: "center",
          width: 499,
        })
    }
  }

  doc.end()

  return done
}

export function generateSalesInvoicePDF(
  invoice: PdfDocumentData,
  storeInfo: StoreInfo
) {
  return writeInvoicePdf(
    "Sales Invoice",
    invoice,
    storeInfo,
    "Bill To",
    businessFooterLines
  )
}

export function generateProformaPDF(
  proforma: PdfDocumentData,
  storeInfo: StoreInfo
) {
  return writeInvoicePdf(
    "Proforma Invoice",
    proforma,
    storeInfo,
    "Proforma To",
    businessFooterLines,
    "Thank You For Doing Business With B Ikaze Hardware"
  )
}
