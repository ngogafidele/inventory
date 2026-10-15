// Persists products proposed by non-admin users until an admin reviews them.
//
// Kept apart from Product on purpose: every sale, return, report, and
// valuation reads the Product collection, so a proposal that never becomes a
// Product can never be sold or counted, with no filter to forget.
import mongoose, { Schema } from "mongoose"

const PackUnitSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    factor: { type: Number, required: true, min: 2 },
    price: { type: Number, required: true, min: 0 },
  },
  { _id: false }
)

const ProductRequestSchema = new Schema(
  {
    store: {
      type: String,
      enum: ["store1", "store2"],
      required: true,
    },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      required: true,
      default: "pending",
    },
    // The proposed product, in the same shape the product form submits:
    // quantities and costs in base units, as CreateProductSchema expects.
    name: { type: String, required: true, trim: true },
    unit: { type: String, required: true, trim: true },
    packUnits: { type: [PackUnitSchema], default: [] },
    costUnit: { type: String, trim: true },
    quantity: { type: Number, required: true, min: 0, default: 0 },
    openingUnit: { type: String, trim: true },
    lowStockThreshold: { type: Number, min: 0, default: 0 },
    costPrice: { type: Number, required: true, min: 0, default: 0 },
    price: { type: Number, required: true, min: 0 },
    supplierName: { type: String, trim: true },
    supplierPhone: { type: String, trim: true },
    submittedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    reviewedBy: { type: Schema.Types.ObjectId, ref: "User" },
    reviewedAt: { type: Date },
    rejectionReason: { type: String, trim: true, default: "" },
    // The product created on approval.
    productId: { type: Schema.Types.ObjectId, ref: "Product" },
  },
  { timestamps: true }
)

ProductRequestSchema.index({ store: 1, status: 1, createdAt: -1 })
ProductRequestSchema.index({ store: 1, submittedBy: 1, createdAt: -1 })

export type ProductRequestDocument =
  mongoose.InferSchemaType<typeof ProductRequestSchema>

export const ProductRequest =
  (mongoose.models.ProductRequest as mongoose.Model<ProductRequestDocument>) ||
  mongoose.model<ProductRequestDocument>("ProductRequest", ProductRequestSchema)
