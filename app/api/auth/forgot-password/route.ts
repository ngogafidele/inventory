import { NextRequest, NextResponse } from "next/server"
import { connectToDatabase } from "@/lib/db/connection"
import { User } from "@/lib/db/models/User"
import { PasswordResetToken } from "@/lib/db/models/PasswordResetToken"
import { ForgotPasswordSchema } from "@/lib/db/validators/user"
import { createPasswordResetToken } from "@/lib/auth/password-reset"
import { sendAdminPasswordResetEmail } from "@/lib/email/password-reset"

const SUCCESS_RESPONSE = {
  success: true,
  message:
    "If an active admin account exists for that email, a reset link will be sent.",
}

function getResetBaseUrl(request: NextRequest) {
  if (process.env.APP_URL) return process.env.APP_URL
  if (process.env.NODE_ENV === "production") {
    throw new Error("APP_URL is not configured")
  }
  return request.nextUrl.origin
}

export async function POST(request: NextRequest) {
  try {
    const body = ForgotPasswordSchema.parse(await request.json())
    await connectToDatabase()

    const user = await User.findOne({
      email: body.email.toLowerCase(),
      isAdmin: true,
      isActive: true,
    })

    if (!user) {
      return NextResponse.json(SUCCESS_RESPONSE)
    }

    const resetBaseUrl = getResetBaseUrl(request)
    const { token, tokenHash, expiresAt } = createPasswordResetToken()

    await PasswordResetToken.create({
      userId: user._id,
      tokenHash,
      expiresAt,
    })

    const resetUrl = new URL("/reset-password", resetBaseUrl)
    resetUrl.searchParams.set("token", token)

    try {
      await sendAdminPasswordResetEmail({
        to: user.email,
        resetUrl: resetUrl.toString(),
      })
    } catch (error) {
      console.error("[Password Reset Email Error]", error)
    }

    return NextResponse.json(SUCCESS_RESPONSE)
  } catch (error) {
    console.error("[Forgot Password Error]", error)
    return NextResponse.json(SUCCESS_RESPONSE)
  }
}
