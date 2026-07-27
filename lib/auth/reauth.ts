// Step-up authentication policy: which routes demand the signed-in user
// re-enter their password, and how long that proof stays good for. Kept free
// of server-only imports so client components can read the same values.

export const REAUTH_WINDOW_SECONDS = 10 * 60

export const VERIFY_PATH = "/verify"

// The pages and the endpoints that serve their figures. Gating only the pages
// would leave the same numbers readable straight from the API. The verify
// route is deliberately absent: gating the gate would loop.
export const REAUTH_PATHS = [
  "/dashboard",
  "/reports",
  "/api/dashboard",
  "/api/reports",
] as const

export function requiresReauth(pathname: string) {
  return REAUTH_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`)
  )
}

// Structural, so this module owns the policy without depending on the shape of
// the session token that carries the proof.
export interface ReauthProof {
  reauthAt?: number
}

export function isReauthCurrent(session: ReauthProof) {
  if (!session.reauthAt) return false
  const age = Date.now() - session.reauthAt
  // A negative age means the clock moved backwards since the check. Treating
  // that as expired costs one password prompt; treating it as valid would
  // hold the gate open indefinitely.
  return age >= 0 && age <= REAUTH_WINDOW_SECONDS * 1000
}
