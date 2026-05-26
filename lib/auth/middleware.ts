// Provides route-handler authentication and administrator authorization guards.
import type { NextRequest } from "next/server"
import { getSessionFromRequest } from "@/lib/auth/session"
import { getCurrentUserSession } from "@/lib/auth/current-user"

export async function requireAuth(request: NextRequest) {
  const tokenSession = getSessionFromRequest(request)
  if (!tokenSession) {
    return { authorized: false as const, session: null }
  }

  const session = await getCurrentUserSession(tokenSession)
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
