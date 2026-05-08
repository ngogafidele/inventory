import jwt from "jsonwebtoken"
import type { NextRequest } from "next/server"
import type { ReadonlyRequestCookies } from "next/dist/server/web/spec-extension/adapters/request-cookies"

export const STORE_KEYS = ["store1", "store2"] as const
export type StoreKey = (typeof STORE_KEYS)[number]

export const AUTH_COOKIE = "auth"
export const ADMIN_IDLE_TIMEOUT_SECONDS = 10 * 60
export const STAFF_IDLE_TIMEOUT_SECONDS = 6 * 60 * 60

const JWT_SECRET = process.env.JWT_SECRET
if (!JWT_SECRET) {
  throw new Error("JWT_SECRET is not set")
}

export interface AuthSession {
  userId: string
  name?: string
  email: string
  isAdmin: boolean
  role: "admin" | "manager" | "staff"
  stores: StoreKey[]
  currentStore?: StoreKey
  loginLogId?: string
  lastActivityAt: number
}

export function createToken(session: AuthSession): string {
  const payload: AuthSession = {
    userId: session.userId,
    name: session.name,
    email: session.email,
    isAdmin: session.isAdmin,
    role: session.role,
    stores: session.stores,
    currentStore: session.currentStore,
    loginLogId: session.loginLogId,
    lastActivityAt: session.lastActivityAt ?? Date.now(),
  }

  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: getIdleTimeoutSeconds(payload),
  })
}

export function verifyToken(token: string): AuthSession | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as AuthSession & {
      iat?: number
    }
    const lastActivityAt =
      decoded.lastActivityAt ?? (decoded.iat ? decoded.iat * 1000 : 0)
    const session = { ...decoded, lastActivityAt }

    if (isSessionIdleExpired(session)) {
      return null
    }

    return session
  } catch {
    return null
  }
}

export function getIdleTimeoutSeconds(session: Pick<AuthSession, "isAdmin">) {
  return session.isAdmin
    ? ADMIN_IDLE_TIMEOUT_SECONDS
    : STAFF_IDLE_TIMEOUT_SECONDS
}

export function isSessionIdleExpired(
  session: Pick<AuthSession, "isAdmin" | "lastActivityAt">
) {
  return Date.now() - session.lastActivityAt >
    getIdleTimeoutSeconds(session) * 1000
}

export function refreshSessionActivity(session: AuthSession): AuthSession {
  return { ...session, lastActivityAt: Date.now() }
}

export function getAuthCookieOptions(session: Pick<AuthSession, "isAdmin">) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    maxAge: getIdleTimeoutSeconds(session),
    path: "/",
  }
}

export function getSessionFromRequest(request: NextRequest): AuthSession | null {
  const token = request.cookies.get(AUTH_COOKIE)?.value
  if (!token) return null
  return verifyToken(token)
}

export function getSessionFromCookies(
  cookieStore: ReadonlyRequestCookies
): AuthSession | null {
  const token = cookieStore.get(AUTH_COOKIE)?.value
  if (!token) return null
  return verifyToken(token)
}

export function isStoreKey(value: string | null | undefined): value is StoreKey {
  if (!value) return false
  return STORE_KEYS.includes(value as StoreKey)
}

export function resolveStoreFromRequest(
  request: NextRequest,
  session: AuthSession
): StoreKey | null {
  const storeParam = request.nextUrl.searchParams.get("store")
  const candidate = storeParam ?? session.currentStore ?? session.stores[0]
  if (!isStoreKey(candidate)) return null
  if (!session.stores.includes(candidate)) return null
  return candidate
}

export function resolveStoreFromValue(
  store: string | null | undefined,
  session: AuthSession
): StoreKey | null {
  const candidate = store ?? session.currentStore ?? session.stores[0]
  if (!isStoreKey(candidate)) return null
  if (!session.stores.includes(candidate)) return null
  return candidate
}

export function updateCurrentStore(
  session: AuthSession,
  store: StoreKey
): AuthSession {
  if (!session.stores.includes(store)) {
    throw new Error("User does not have access to this store")
  }
  return { ...session, currentStore: store }
}
