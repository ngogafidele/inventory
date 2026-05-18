import mongoose, { Schema } from "mongoose"

const ReturnItemSchema = new Schema(
  {
    productId: { type: Schema.Types.ObjectId, ref: "Product", required: true },
    name: { type: String, required: true },
    sku: { type: String, required: true },
    unit: { type: String, required: true, default: "pcs" },
    quantity: { type: Number, required: true, min: 1 },
    unitPrice: { type: Number, required: true, min: 0 },
    lineTotal: { type: Number, required: true, min: 0 },
  },
  { _id: false }
)

const ReturnSchema = new Schema(
  {
    store: {
      type: String,
      enum: ["store1", "store2"],
      required: true,
    },
    saleId: { type: Schema.Types.ObjectId, ref: "Sale", required: true },
    items: { type: [ReturnItemSchema], required: true },
    refundAmount: { type: Number, required: true, min: 0 },
    refundMethod: {
      type: String,
      enum: ["cash", "mobile-money", "bank"],
      required: true,
    },
    reason: { type: String, required: true, trim: true },
    returnDate: { type: Date, required: true },
    customerName: { type: String, required: true, trim: true },
    customerPhone: { type: String, required: true, trim: true },
    notes: { type: String, default: "", trim: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
)

ReturnSchema.index({ store: 1, returnDate: -1 })
ReturnSchema.index({ store: 1, saleId: 1 })

export type ReturnDocument = mongoose.InferSchemaType<typeof ReturnSchema>

export const ReturnModel =
  (mongoose.models.Return as mongoose.Model<ReturnDocument>) ||
  mongoose.model<ReturnDocument>("Return", ReturnSchema)
