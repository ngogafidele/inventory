import mongoose, { Schema } from "mongoose"

const CategorySchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, default: "" },
    store: {
      type: String,
      enum: ["store1", "store2"],
      required: true,
    },
  },
  { timestamps: true }
)

CategorySchema.index({ store: 1 })
CategorySchema.index({ store: 1, name: 1 }, { unique: true })

export type CategoryDocument = mongoose.InferSchemaType<typeof CategorySchema>

export const Category =
  (mongoose.models.Category as mongoose.Model<CategoryDocument>) ||
  mongoose.model<CategoryDocument>("Category", CategorySchema)
