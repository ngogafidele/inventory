"use client"

// Explains an automatic sign-out on the login page, once.
import { useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"

const IDLE_NOTICE = "You were signed out because of inactivity."

export function IdleNotice() {
  const searchParams = useSearchParams()
  // Snapshotted on mount so the message survives the cleanup below.
  const [wasIdle] = useState(() => searchParams.get("reason") === "idle")

  useEffect(() => {
    if (!wasIdle) return
    // Drop the marker so a refresh, a back button, or a failed login attempt
    // does not replay a sign-out that already happened. Going through the
    // history API rather than router.replace keeps this from re-rendering the
    // route, which would remount this component and lose the snapshot.
    window.history.replaceState(null, "", window.location.pathname)
  }, [wasIdle])

  if (!wasIdle) return null

  return (
    <div className="mb-4 rounded-lg border border-warning/30 bg-warning/10 p-3 text-sm text-warning">
      {IDLE_NOTICE}
    </div>
  )
}
