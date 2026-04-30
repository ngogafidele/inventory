import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { getSessionFromCookies, type AuthSession } from "@/lib/auth/session"

export function requireServerSession(): AuthSession {
  const session = getSessionFromCookies(cookies())
  if (!session) {
    redirect("/")
  }
  return session
}

export function getCurrentStore(session: AuthSession) {
  return session.currentStore ?? session.stores[0]
}
