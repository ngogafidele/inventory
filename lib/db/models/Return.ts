// Persists returns and replacement details that affect inventory and reports.
import mongoose, { Schema } from "mongoose"

const ReturnItemSchema = new Schema(
  {
    productId: { type: Schema.Types.ObjectId, ref: "Product", required: true },
    name: { type: String, required: true },
    sku: { type: String, required: true },
    unit: { type: String, required: true, default: "pcs" },
    quantity: { type: Number, required: true, min: 1 },
    basePrice: { type: Number, required: true, min: 0, default: 0 },
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
    returnItems: { type: [ReturnItemSchema], required: true },
    replacementItems: { type: [ReturnItemSchema], default: [] },
    totalReturnAmount: { type: Number, required: true, min: 0 },
    totalReplacementAmount: { type: Number, default: 0, min: 0 },
    notes: { type: String, default: "", trim: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
)

ReturnSchema.index({ store: 1, createdAt: -1 })

export type ReturnDocument = mongoose.InferSchemaType<typeof ReturnSchema>

export const ReturnModel =
  (mongoose.models.Return as mongoose.Model<ReturnDocument>) ||
  mongoose.model<ReturnDocument>("Return", ReturnSchema)
