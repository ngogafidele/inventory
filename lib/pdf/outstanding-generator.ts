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
  end(): void
}

const logoPath = path.join(process.cwd(), "public", "images", "logo.png")
const logoBox = {
  x: 42,
  y: 24,
  width: 174,
  height: 174,
  imageX: 48,
  imageY: 30,
  imageFit: [162, 162] as [number, number],
}

const paymentMethodsLines = [
  "Equity Bank Account: 4005201187639",
  "Tin: 111049695",
  "Tel No: 0788399098",
  "",
  "B Ikaze Hardware",
]

function getLogoBuffer() {
  if (!existsSync(logoPath)) return null
  return readFileSync(logoPath)
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
        .fontSize(16)
        .fillColor("#002050")
        .text(storeInfo.name ?? "Inventory", 48, 72, { width: 150 })
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

  const doc = new PDFDocument({ margin: 48, size: "A4" }) as OutstandingPdfDocument
  const chunks: Buffer[] = []

  doc.on("data", (chunk: Buffer) => chunks.push(chunk))

  const done = new Promise<Buffer>((resolve, reject) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)))
    doc.on("error", reject)
  })

  drawLogo(doc, storeInfo)

  doc
    .fillColor("#111827")
    .fontSize(22)
    .text("Outstanding Statement", 340, 58, { align: "right" })
    .fontSize(10)
    .fillColor("#5f6673")
    .text(payload.statementNumber, 340, 88, { align: "right" })
    .text(`Date: ${formatDate(payload.generatedAt)}`, 340, 104, {
      align: "right",
    })

  doc
    .moveTo(48, 210)
    .lineTo(547, 210)
    .lineWidth(1.5)
    .strokeColor("#f08010")
    .stroke()

  doc
    .fontSize(11)
    .fillColor("#111827")
    .text(storeInfo.name ?? "Multi-Store Inventory", 48, 230)
    .fontSize(9)
    .fillColor("#5f6673")
    .text(storeInfo.address ?? "", 48, 248)
    .text(storeInfo.phone ?? "", 48, 262)
    .text(storeInfo.email ?? "", 48, 276)

  doc
    .fontSize(11)
    .fillColor("#111827")
    .text("Customer", 330, 230)
    .fontSize(9)
    .fillColor("#5f6673")
    .text(payload.customerName, 330, 248)
    .text(payload.customerPhone ?? "", 330, 262)

  const tableTop = 320
  const columns = {
    saleDate: 54,
    paymentDate: 130,
    items: 206,
    recordedBy: 392,
    amount: 478,
  }

  doc
    .rect(48, tableTop, 499, 24)
    .fillColor("#eef3f8")
    .fill()
    .fillColor("#00183d")
    .fontSize(9)
    .text("Sale Date", columns.saleDate, tableTop + 8)
    .text("Payment", columns.paymentDate, tableTop + 8)
    .text("Items", columns.items, tableTop + 8)
    .text("Recorded", columns.recordedBy, tableTop + 8)
    .text("Amount", columns.amount, tableTop + 8)

  let y = tableTop + 32

  payload.rows.forEach((row, index) => {
    const itemsHeight = doc.heightOfString(row.items, { width: 160 })
    const recordedByHeight = doc.heightOfString(row.recordedBy, {
      width: 80,
    })
    const rowHeight = Math.max(22, itemsHeight, recordedByHeight) + 12

    if (y + rowHeight > 700) {
      doc.addPage()
      y = 56
    }

    doc
      .fillColor(index % 2 === 0 ? "#ffffff" : "#fbfcfe")
      .rect(48, y - 6, 499, rowHeight)
      .fill()
      .fillColor("#111827")
      .fontSize(9)
      .text(formatDate(row.saleDate), columns.saleDate, y, { width: 70 })
      .text(formatDate(row.paymentDate), columns.paymentDate, y, {
        width: 70,
      })
      .text(row.items, columns.items, y, { width: 160 })
      .text(row.recordedBy, columns.recordedBy, y, { width: 80 })
      .text(formatCurrency(row.amount), columns.amount, y, { width: 70 })

    y += rowHeight + 4
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
    .fontSize(12)
    .fillColor("#111827")
    .text("Total Outstanding", 330, y + 16)
    .text(formatCurrency(payload.totalOutstanding), 448, y + 16, {
      width: 90,
    })

  const paymentBlockY = y + 56
  doc
    .font("Helvetica-Bold")
    .fontSize(9)
    .fillColor("#111827")
    .text(paymentMethodsLines.join("\n"), 48, paymentBlockY, {
      width: 220,
    })

  doc.end()

  return done
}
