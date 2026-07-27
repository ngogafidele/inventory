// Requires the acting user to re-enter their password before a destructive
// action goes through.
//
// Deliberately separate from the page gate in lib/auth/reauth: that one opens
// a ten-minute viewing window, and reusing it here would mean an admin who
// merely opened the dashboard could then delete records unchallenged. This is
// proven per action, so nothing carries over.
import { NextResponse, type NextRequest } from "next/server"
import { connectToDatabase } from "@/lib/db/connection"
import { User } from "@/lib/db/models/User"
import { comparePassword } from "@/lib/auth/hash"
import type { AuthSession } from "@/lib/auth/session"

type VerifyResult = { ok: true } | { ok: false; response: NextResponse }

function reject(error: string, status: number): VerifyResult {
  return {
    ok: false,
    response: NextResponse.json({ success: false, error }, { status }),
  }
}

export async function verifyActionPassword(
  request: NextRequest,
  session: Pick<AuthSession, "userId">
): Promise<VerifyResult> {
  let password: unknown
  try {
    const body = (await request.json()) as { password?: unknown }
    password = body?.password
  } catch {
    // No body at all, or malformed. Treated the same as omitting the password.
    return reject("Password required", 400)
  }

  if (typeof password !== "string" || password.length === 0) {
    return reject("Password required", 400)
  }

  await connectToDatabase()
  const user = await User.findById(session.userId).select("password")
  if (!user) {
    return reject("Session expired", 401)
  }

  if (!(await comparePassword(password, user.password))) {
    return reject("Incorrect password", 401)
  }

  return { ok: true }
}
