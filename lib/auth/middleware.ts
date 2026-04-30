import type { NextRequest } from "next/server"
import { getSessionFromRequest } from "@/lib/auth/session"

export async function requireAuth(request: NextRequest) {
  const session = getSessionFromRequest(request)
  if (!session) {
    return { authorized: false as const, session: null }
  }
  return { authorized: true as const, session }
}

export async function requireAdmin(request: NextRequest) {
  const result = await requireAuth(request)
  if (!result.authorized || !result.session) {
    return { authorized: false as const, session: result.session }
  }
  if (!result.session.isAdmin) {
    return { authorized: false as const, session: result.session }
  }
  return { authorized: true as const, session: result.session }
}
