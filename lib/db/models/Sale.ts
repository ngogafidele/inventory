import mongoose, { Schema } from "mongoose"

const SaleItemSchema = new Schema(
  {
    productId: { type: Schema.Types.ObjectId, ref: "Product", required: true },
    name: { type: String, required: true },
    sku: { type: String, required: true },
    unit: { type: String, required: true, default: "pcs" },
    quantity: { type: Number, required: true, min: 1 },
    basePrice: { type: Number, required: true, min: 0 },
    sellingPrice: { type: Number, required: true, min: 0 },
    lineTotal: { type: Number, required: true, min: 0 },
  },
  { _id: false }
)

const OutstandingSchema = new Schema(
  {
    customerName: { type: String, required: true },
    customerPhone: { type: String },
    paymentDate: { type: Date },
  },
  { _id: false }
)

const SaleSchema = new Schema(
  {
    store: {
      type: String,
      enum: ["store1", "store2"],
      required: true,
    },
    items: { type: [SaleItemSchema], required: true },
    totalAmount: { type: Number, required: true, min: 0 },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    paymentStatus: {
      type: String,
      enum: ["paid", "unpaid"],
      default: "paid",
    },
    paymentMethod: {
      type: String,
      enum: ["cash", "bank", "mobile"],
      default: undefined,
    },
    outstanding: { type: OutstandingSchema, default: undefined },
    notes: { type: String, default: "" },
  },
  { timestamps: true }
)

SaleSchema.index({ store: 1 })
SaleSchema.index({ store: 1, paymentStatus: 1, "outstanding.paymentDate": 1 })

export type SaleDocument = mongoose.InferSchemaType<typeof SaleSchema>

export const Sale =
  (mongoose.models.Sale as mongoose.Model<SaleDocument>) ||
  mongoose.model<SaleDocument>("Sale", SaleSchema)
