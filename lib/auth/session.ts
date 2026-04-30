import jwt from "jsonwebtoken"
import type { NextRequest } from "next/server"
import type { ReadonlyRequestCookies } from "next/dist/server/web/spec-extension/adapters/request-cookies"

export const STORE_KEYS = ["store1", "store2"] as const
export type StoreKey = (typeof STORE_KEYS)[number]

export const AUTH_COOKIE = "auth"

const JWT_SECRET = process.env.JWT_SECRET
if (!JWT_SECRET) {
  throw new Error("JWT_SECRET is not set")
}

export interface AuthSession {
  userId: string
  email: string
  isAdmin: boolean
  role: "admin" | "manager" | "staff"
  stores: StoreKey[]
  currentStore?: StoreKey
}

export function createToken(session: AuthSession): string {
  return jwt.sign(session, JWT_SECRET, { expiresIn: "7d" })
}

export function verifyToken(token: string): AuthSession | null {
  try {
    return jwt.verify(token, JWT_SECRET) as AuthSession
  } catch {
    return null
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
