// Persists paid and credit sales together with their item value snapshots.
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

// An outstanding record means goods have been issued but payment is pending.
const OutstandingSchema = new Schema(
  {
    customerName: { type: String, required: true },
    customerPhone: { type: String },
    paymentDate: { type: Date },
  },
  { _id: false }
)

const CustomerSchema = new Schema(
  {
    name: { type: String },
    phone: { type: String },
  },
  { _id: false }
)

const LoanPaymentSchema = new Schema(
  {
    amount: { type: Number, required: true, min: 0 },
    paymentMethod: {
      type: String,
      enum: ["cash", "bank", "mobile"],
      required: true,
    },
    paidAt: { type: Date, required: true, default: Date.now },
    receivedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    notes: { type: String, default: "" },
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
    customer: { type: CustomerSchema, default: undefined },
    outstanding: { type: OutstandingSchema, default: undefined },
    payments: { type: [LoanPaymentSchema], default: [] },
    amountPaid: { type: Number, required: true, default: 0, min: 0 },
    remainingBalance: { type: Number, required: true, default: 0, min: 0 },
    notes: { type: String, default: "" },
  },
  { timestamps: true }
)

SaleSchema.index({ store: 1 })
// Supports the loan queue ordered by expected collection date.
SaleSchema.index({ store: 1, paymentStatus: 1, "outstanding.paymentDate": 1 })

export type SaleDocument = mongoose.InferSchemaType<typeof SaleSchema>

export const Sale =
  (mongoose.models.Sale as mongoose.Model<SaleDocument>) ||
  mongoose.model<SaleDocument>("Sale", SaleSchema)
