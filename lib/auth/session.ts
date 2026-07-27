// Defines signed session state, idle expiry, and authorized store resolution.
import jwt from "jsonwebtoken"
import type { NextRequest } from "next/server"
import type { ReadonlyRequestCookies } from "next/dist/server/web/spec-extension/adapters/request-cookies"
import { getIdleTimeoutSeconds, isSessionIdleExpired } from "@/lib/auth/idle"

export const STORE_KEYS = ["store1", "store2"] as const
export type StoreKey = (typeof STORE_KEYS)[number]

export const AUTH_COOKIE = "auth"

// Narrowed through a function so the checked type reaches jwt.sign/verify;
// a module-level const stays `string | undefined` inside function bodies.
function requireJwtSecret(): string {
  const secret = process.env.JWT_SECRET
  if (!secret) {
    throw new Error("JWT_SECRET is not set")
  }
  return secret
}

const JWT_SECRET = requireJwtSecret()

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
  // Set while the last page navigation was on a STRICT_PATHS route. Absent on
  // tokens issued before this existed, which keeps them on the old timeouts.
  strict?: boolean
  // When the user last re-entered their password. Server-set only: the client
  // never supplies it, so the gate cannot be opened by editing a request.
  reauthAt?: number
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
    strict: session.strict,
    reauthAt: session.reauthAt,
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

export function refreshSessionActivity(session: AuthSession): AuthSession {
  return { ...session, lastActivityAt: Date.now() }
}

export function getAuthCookieOptions(
  session: Pick<AuthSession, "isAdmin" | "strict">
) {
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

// An idle timeout is precisely the case where the logout needs recording and
// the token has already lapsed, so identity has to be readable past expiry.
// The signature is still verified, so the userId cannot be forged; the only
// thing this grants a lapsed token is the ability to close its own audit row.
// Never authorize anything with this — logout stamping is the whole use.
export function readLapsedSession(token: string): AuthSession | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET, {
      ignoreExpiration: true,
    }) as AuthSession & { iat?: number }
    return {
      ...decoded,
      lastActivityAt:
        decoded.lastActivityAt ?? (decoded.iat ? decoded.iat * 1000 : 0),
    }
  } catch {
    return null
  }
}

export function getLapsedSessionFromRequest(
  request: NextRequest
): AuthSession | null {
  const token = request.cookies.get(AUTH_COOKIE)?.value
  if (!token) return null
  return readLapsedSession(token)
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

// Never accept a requested store unless it is included in the user's session.
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

// Server-rendered pages use the same store authorization rule as route handlers.
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
