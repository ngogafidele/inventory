// Persists supplier product receipts that increase branch stock.
import mongoose, { Schema } from "mongoose"

const ProductReceiptSchema = new Schema(
  {
    store: {
      type: String,
      enum: ["store1", "store2"],
      required: true,
    },
    productId: { type: Schema.Types.ObjectId, ref: "Product", required: true },
    sku: { type: String, required: true },
    supplierName: { type: String, required: true, trim: true },
    supplierPhone: { type: String, required: true, trim: true },
    quantity: { type: Number, required: true, min: 1 },
    unitCost: { type: Number, required: true, min: 0 },
    totalCost: { type: Number, required: true, min: 0 },
    receivedAt: { type: Date, required: true },
    receivedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
)

ProductReceiptSchema.index({ store: 1, productId: 1, receivedAt: -1 })

export type ProductReceiptDocument =
  mongoose.InferSchemaType<typeof ProductReceiptSchema>

export const ProductReceipt =
  (mongoose.models.ProductReceipt as mongoose.Model<ProductReceiptDocument>) ||
  mongoose.model<ProductReceiptDocument>(
    "ProductReceipt",
    ProductReceiptSchema
  )
