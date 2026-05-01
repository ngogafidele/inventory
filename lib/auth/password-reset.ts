import { createHash, randomBytes } from "crypto"

export const PASSWORD_RESET_TOKEN_BYTES = 32
export const PASSWORD_RESET_TOKEN_TTL_MINUTES = 30

export function createPasswordResetToken() {
  const token = randomBytes(PASSWORD_RESET_TOKEN_BYTES).toString("base64url")
  return {
    token,
    tokenHash: hashPasswordResetToken(token),
    expiresAt: new Date(
      Date.now() + PASSWORD_RESET_TOKEN_TTL_MINUTES * 60 * 1000
    ),
  }
}

export function hashPasswordResetToken(token: string) {
  return createHash("sha256").update(token).digest("hex")
}
