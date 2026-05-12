declare module "pdfkit" {
  import { EventEmitter } from "events"

  type TextOptions = {
    align?: "left" | "center" | "right" | "justify"
    width?: number
  }

  type ImageOptions = {
    width?: number
    height?: number
    fit?: [number, number]
  }

  class PDFDocument extends EventEmitter {
    constructor(options?: { margin?: number; size?: string })
    image(src: string | Buffer, x?: number, y?: number, options?: ImageOptions): this
    text(text: string, x?: number, y?: number, options?: TextOptions): this
    font(name: string): this
    fontSize(size: number): this
    fillColor(color: string): this
    strokeColor(color: string): this
    lineWidth(width: number): this
    moveTo(x: number, y: number): this
    lineTo(x: number, y: number): this
    rect(x: number, y: number, width: number, height: number): this
    fill(): this
    stroke(): this
    addPage(): this
    end(): void
  }

  export default PDFDocument
}
