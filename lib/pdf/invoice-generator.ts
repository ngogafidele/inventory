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

const businessFooterLines = [
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

function writeInvoicePdf(
  title: string,
  data: PdfDocumentData,
  storeInfo: StoreInfo,
  recipientLabel = "Bill To",
  footerLines: string[] = []
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

  doc
    .fillColor("#111827")
    .fontSize(22)
    .text(title, 340, 58, { align: "right" })
    .fontSize(10)
    .fillColor("#5f6673")
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
    .text(recipientLabel, 330, 230)
    .fontSize(9)
    .fillColor("#5f6673")
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
    .fillColor("#00183d")
    .fontSize(9)
    .text("Item", columns.item, tableTop + 8)
    .text("Qty", columns.quantity, tableTop + 8)
    .text("Price", columns.price, tableTop + 8)
    .text("Total", columns.total, tableTop + 8)

  let y = tableTop + 32
  data.items.forEach((item, index) => {
    if (y > 700) {
      doc.addPage()
      y = 56
    }

    doc
      .fillColor(index % 2 === 0 ? "#ffffff" : "#fbfcfe")
      .rect(48, y - 7, 499, 34)
      .fill()
      .fillColor("#111827")
      .fontSize(9)
      .text(item.description, columns.item, y, { width: 210 })
      .fillColor("#6b7280")
      .fontSize(8)
      .text(item.sku ?? "", columns.item, y + 13, { width: 210 })
      .fillColor("#111827")
      .fontSize(9)
      .text(`${item.quantity} ${item.unit ?? "pcs"}`, columns.quantity, y)
      .text(formatCurrency(item.unitPrice), columns.price, y, { width: 82 })
      .text(formatCurrency(item.lineTotal), columns.total, y, { width: 92 })

    y += 36
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
    .fontSize(14)
    .fillColor("#111827")
    .text("Total", 355, y + 20)
    .text(formatCurrency(data.totalAmount), 448, y + 20, { width: 92 })

  if (footerLines.length > 0) {
    let footerY = y + 58
    if (footerY > 700) {
      doc.addPage()
      footerY = 56
    }

    doc
      .font("Helvetica-Bold")
      .fontSize(9)
      .fillColor("#111827")
      .text(footerLines.join("\n"), 48, footerY, { width: 220 })
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
    businessFooterLines
  )
}
