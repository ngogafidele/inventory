import mongoose, { Schema } from "mongoose"

const InvoiceSchema = new Schema(
  {
    store: {
      type: String,
      enum: ["store1", "store2"],
      required: true,
    },
    saleId: { type: Schema.Types.ObjectId, ref: "Sale", required: true },
    invoiceNumber: { type: String, required: true },
    customerName: { type: String, required: true },
    customerEmail: { type: String, default: "" },
    customerPhone: { type: String, default: "" },
    totalAmount: { type: Number, required: true, min: 0 },
    status: {
      type: String,
      enum: ["unpaid", "paid"],
      default: "unpaid",
    },
    issuedAt: { type: Date, default: Date.now },
    dueDate: { type: Date },
  },
  { timestamps: true }
)

InvoiceSchema.index({ store: 1 })
InvoiceSchema.index({ store: 1, invoiceNumber: 1 }, { unique: true })

export type InvoiceDocument = mongoose.InferSchemaType<typeof InvoiceSchema>

export const Invoice =
  mongoose.models.Invoice || mongoose.model("Invoice", InvoiceSchema)
