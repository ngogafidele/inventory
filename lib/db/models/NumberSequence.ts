import mongoose, { Schema } from "mongoose"

const NumberSequenceSchema = new Schema(
  {
    storeId: { type: String, required: true },
    type: {
      type: String,
      enum: ["invoice", "proforma"],
      required: true,
    },
    year: { type: Number, required: true },
    month: { type: Number, required: true },
    sequence: { type: Number, required: true, default: 0 },
  },
  { timestamps: true }
)

NumberSequenceSchema.index(
  { storeId: 1, type: 1, year: 1, month: 1 },
  { unique: true }
)

export type NumberSequenceDocument = mongoose.InferSchemaType<
  typeof NumberSequenceSchema
>

export const NumberSequence =
  (mongoose.models.NumberSequence as mongoose.Model<NumberSequenceDocument>) ||
  mongoose.model<NumberSequenceDocument>(
    "NumberSequence",
    NumberSequenceSchema
  )
