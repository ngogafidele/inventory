import mongoose, { Schema } from "mongoose"

const MAX_LOGIN_LOGS = 50

const UserLoginLogSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    name: { type: String, required: true },
    email: { type: String, required: true },
    role: {
      type: String,
      enum: ["admin", "manager", "staff"],
      required: true,
    },
    loginAt: { type: Date, required: true, default: Date.now },
    logoutAt: { type: Date },
  },
  { timestamps: true }
)

UserLoginLogSchema.index({ loginAt: -1 })
UserLoginLogSchema.index({ userId: 1, loginAt: -1 })

export type UserLoginLogDocument = mongoose.InferSchemaType<
  typeof UserLoginLogSchema
>

type LoginLogIdOnly = {
  _id: mongoose.Types.ObjectId
}

export const UserLoginLog =
  mongoose.models.UserLoginLog ||
  mongoose.model("UserLoginLog", UserLoginLogSchema)

export async function pruneOldLoginLogs(limit = MAX_LOGIN_LOGS) {
  const logsToRemove = await UserLoginLog.find()
    .sort({ loginAt: -1, _id: -1 })
    .skip(limit)
    .select("_id")
    .lean<LoginLogIdOnly[]>()

  if (logsToRemove.length === 0) return

  await UserLoginLog.deleteMany({
    _id: { $in: logsToRemove.map((log) => log._id) },
  })
}
