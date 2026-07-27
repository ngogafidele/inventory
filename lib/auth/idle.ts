// Idle-window policy: how long a session may sit untouched, and which routes
// tighten that. Kept free of server-only imports so the client guard can read
// the same numbers instead of restating them.
export const ADMIN_IDLE_TIMEOUT_SECONDS = 1 * 60 * 60
export const STAFF_IDLE_TIMEOUT_SECONDS = 6 * 60 * 60
export const STRICT_IDLE_TIMEOUT_SECONDS = 10 * 60

// Pages that expose aggregate financial data get a much shorter idle window.
// The verify gate is included so stepping through it cannot widen the window
// back to the relaxed timeout on the way in.
export const STRICT_PATHS = [
  "/dashboard",
  "/reports",
  "/financial-statements",
  "/verify",
] as const

export function isStrictPath(pathname: string) {
  return STRICT_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`)
  )
}

// Structural, so this module owns the policy without depending on the shape of
// the session token that happens to carry it.
export interface IdleWindow {
  isAdmin: boolean
  strict?: boolean
}

export function getIdleTimeoutSeconds(session: IdleWindow) {
  if (session.strict) return STRICT_IDLE_TIMEOUT_SECONDS
  return session.isAdmin
    ? ADMIN_IDLE_TIMEOUT_SECONDS
    : STAFF_IDLE_TIMEOUT_SECONDS
}

export function isSessionIdleExpired(
  session: IdleWindow & { lastActivityAt: number }
) {
  return (
    Date.now() - session.lastActivityAt > getIdleTimeoutSeconds(session) * 1000
  )
}
