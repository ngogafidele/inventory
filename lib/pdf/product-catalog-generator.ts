// Renders printable product catalog and inventory valuation PDFs.
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

type CatalogProduct = {
  name: string
  sku: string
  unit?: string
  quantity: number
  lowStockThreshold?: number
  costPrice: number
  price: number
}

type ProductCatalogPayload = {
  generatedAt?: Date | string
  products: CatalogProduct[]
}

type StoreInfo = {
  name?: string
  address?: string
  phone?: string
  email?: string
}

type ProductCatalogPdfDocument = {
  rect(x: number, y: number, width: number, height: number): ProductCatalogPdfDocument
  fillColor(color: string): ProductCatalogPdfDocument
  fill(): ProductCatalogPdfDocument
  image(
    src: string | Buffer,
    x?: number,
    y?: number,
    options?: { width?: number; height?: number; fit?: [number, number] }
  ): ProductCatalogPdfDocument
  font(name: string): ProductCatalogPdfDocument
  fontSize(size: number): ProductCatalogPdfDocument
  text(
    text: string,
    x?: number,
    y?: number,
    options?: { align?: "left" | "right" | "center"; width?: number }
  ): ProductCatalogPdfDocument
  lineTo(x: number, y: number): ProductCatalogPdfDocument
  moveTo(x: number, y: number): ProductCatalogPdfDocument
  lineWidth(width: number): ProductCatalogPdfDocument
  strokeColor(color: string): ProductCatalogPdfDocument
  stroke(): ProductCatalogPdfDocument
  addPage(): ProductCatalogPdfDocument
  heightOfString(text: string, options?: { width?: number }): number
  widthOfString(text: string): number
  on(event: "data", listener: (chunk: Buffer) => void): ProductCatalogPdfDocument
  on(event: "end", listener: () => void): ProductCatalogPdfDocument
  on(event: "error", listener: (error: unknown) => void): ProductCatalogPdfDocument
  end(): void
}

const logoPath = path.join(process.cwd(), "public", "images", "logo.png")
const logoBox = {
  x: 42,
  y: 24,
  width: 150,
  height: 150,
  imageX: 48,
  imageY: 30,
  imageFit: [138, 138] as [number, number],
}

const PRINT_TEXT = "#111827"
const PRINT_MUTED_TEXT = "#1f2937"
const PRINT_HEADER_TEXT = "#00183d"
const TABLE_ROW_HEIGHT = 24

function mutedText(doc: ProductCatalogPdfDocument) {
  return doc.font("Helvetica").fillColor(PRINT_MUTED_TEXT)
}

function boldText(doc: ProductCatalogPdfDocument) {
  return doc.font("Helvetica-Bold").fillColor(PRINT_TEXT)
}

function getLogoBuffer() {
  if (!existsSync(logoPath)) return null
  return readFileSync(logoPath)
}

function drawLogo(doc: ProductCatalogPdfDocument, storeInfo: StoreInfo) {
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
      console.error("[Products Catalog PDF Logo Error]", {
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

function formatDate(value: Date | string | undefined) {
  if (!value) return "-"
  return new Intl.DateTimeFormat("en-RW", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value))
}

function truncateToWidth(
  doc: ProductCatalogPdfDocument,
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

function drawTableHeader(doc: ProductCatalogPdfDocument, y: number) {
  const columns = getColumns()

  doc
    .rect(48, y, 745, 24)
    .fillColor("#eef3f8")
    .fill()
    .font("Helvetica-Bold")
    .fillColor(PRINT_HEADER_TEXT)
    .fontSize(8)
    .text("#", columns.index, y + 8, { width: 24 })
    .text("Product", columns.product, y + 8, { width: 178 })
    .text("Qty", columns.quantity, y + 8, { width: 62 })
    .text("Low Stock", columns.lowStock, y + 8, { width: 62 })
    .text("Cost Price", columns.costPrice, y + 8, { width: 82 })
    .text("Selling Price", columns.price, y + 8, { width: 82 })
    .text("Status", columns.status, y + 8, { width: 70 })
}

function getColumns() {
  return {
    index: 54,
    product: 84,
    quantity: 292,
    lowStock: 374,
    costPrice: 464,
    price: 572,
    status: 686,
  }
}

export function generateProductCatalogPDF(
  payload: ProductCatalogPayload,
  storeInfo: StoreInfo
) {
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
  }) as unknown as ProductCatalogPdfDocument
  const chunks: Buffer[] = []

  doc.on("data", (chunk: Buffer) => chunks.push(chunk))

  const done = new Promise<Buffer>((resolve, reject) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)))
    doc.on("error", reject)
  })

  drawLogo(doc, storeInfo)

  boldText(doc).fontSize(22).text("Products Catalog", 520, 58, {
    align: "right",
    width: 270,
  })
  mutedText(doc)
    .fontSize(10)
    .text(`${payload.products.length} products`, 520, 88, {
      align: "right",
      width: 270,
    })
    .text(`Generated: ${formatDate(payload.generatedAt)}`, 520, 104, {
      align: "right",
      width: 270,
    })

  doc
    .moveTo(48, 188)
    .lineTo(793, 188)
    .lineWidth(1.5)
    .strokeColor("#f08010")
    .stroke()

  boldText(doc).fontSize(11).text(storeInfo.name ?? "Multi-Store Inventory", 48, 210)
  mutedText(doc)
    .fontSize(9)
    .text(storeInfo.address ?? "", 48, 228)
    .text(storeInfo.phone ?? "", 48, 242)
    .text(storeInfo.email ?? "", 48, 256)

  const columns = getColumns()
  const tableTop = 296
  drawTableHeader(doc, tableTop)

  let y = tableTop + 32

  if (payload.products.length === 0) {
    mutedText(doc).fontSize(9).text("No products found.", 54, y)
    y += 28
  }

  payload.products.forEach((product, index) => {
    const quantity = `${product.quantity} ${product.unit ?? "pcs"}`
    const lowStockThreshold = product.lowStockThreshold ?? 0
    const status = product.quantity <= lowStockThreshold ? "Low stock" : "In stock"

    if (y + TABLE_ROW_HEIGHT > 540) {
      doc.addPage()
      y = 56
      drawTableHeader(doc, y)
      y += 32
    }

    doc.font("Helvetica-Bold").fontSize(8)
    const name = truncateToWidth(doc, product.name, 178)
    doc.font("Helvetica").fontSize(7)
    const sku = truncateToWidth(doc, product.sku, 178)
    doc.font("Helvetica").fontSize(8)
    const quantityText = truncateToWidth(doc, quantity, 62)
    const lowStockText = truncateToWidth(doc, String(lowStockThreshold), 62)
    const costPrice = truncateToWidth(doc, formatCurrency(product.costPrice ?? 0), 82)
    const price = truncateToWidth(doc, formatCurrency(product.price), 82)

    doc
      .fillColor(index % 2 === 0 ? "#ffffff" : "#fbfcfe")
      .rect(48, y - 7, 745, TABLE_ROW_HEIGHT)
      .fill()
      .font("Helvetica")
      .fillColor(PRINT_TEXT)
      .fontSize(8)
      .text(String(index + 1), columns.index, y, { width: 24 })
      .font("Helvetica-Bold")
      .text(name, columns.product, y, { width: 178 })
      .font("Helvetica")
      .fillColor(PRINT_MUTED_TEXT)
      .fontSize(7)
      .text(sku, columns.product, y + 10, { width: 178 })
      .fontSize(8)
      .fillColor(PRINT_TEXT)
      .text(quantityText, columns.quantity, y, { width: 62 })
      .text(lowStockText, columns.lowStock, y, { width: 62 })
      .text(costPrice, columns.costPrice, y, { width: 82 })
      .text(price, columns.price, y, { width: 82 })
      .text(status, columns.status, y, { width: 70 })

    y += TABLE_ROW_HEIGHT + 2
  })

  if (y > 520) {
    doc.addPage()
    y = 56
  }

  doc
    .moveTo(48, y)
    .lineTo(793, y)
    .strokeColor("#d8dee8")
    .stroke()
    .font("Helvetica-Bold")
    .fontSize(10)
    .fillColor(PRINT_TEXT)
    .text(`Total products: ${payload.products.length}`, 48, y + 16)

  doc.end()

  return done
}
