import type { AuthSession } from "@/lib/auth/session"

export function canViewAnalytics(session: AuthSession) {
  return session.isAdmin
}

export function canManageUsers(session: AuthSession) {
  return session.isAdmin
}

export function canManageProducts(session: AuthSession) {
  return session.isAdmin
}

export function canManageCategories(session: AuthSession) {
  return session.isAdmin
}

export function canRecordSales(session: AuthSession) {
  return session.isAdmin || session.role !== "admin"
}
