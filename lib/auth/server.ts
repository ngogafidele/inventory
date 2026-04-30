import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { getSessionFromCookies, type AuthSession } from "@/lib/auth/session"

export async function requireServerSession(): Promise<AuthSession> {
  const cookieStore = await cookies()
  const session = getSessionFromCookies(cookieStore)
  if (!session) {
    redirect("/")
  }
  return session
}

export function getCurrentStore(session: AuthSession) {
  return session.currentStore ?? session.stores[0]
}
